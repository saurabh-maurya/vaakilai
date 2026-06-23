"""
G5 — Document Comparison (Redline)
AI-powered comparison between two legal documents.
Identifies additions, deletions, changed clauses, and risk changes.
"""

import logging
from fastapi import APIRouter, HTTPException, Depends
from middleware.auth_middleware import require_pro_plan
from pydantic import BaseModel, Field
from typing import List, Optional
import difflib

from config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Models ─────────────────────────────────────────────────────────────────────

class DocCompareRequest(BaseModel):
    doc_a: str = Field(..., min_length=50, description="Original document text")
    doc_b: str = Field(..., min_length=50, description="Revised document text")
    doc_a_label: str = Field(default="Version A (Original)")
    doc_b_label: str = Field(default="Version B (Revised)")
    focus_areas: Optional[List[str]] = Field(
        default=None,
        description="Specific areas to focus analysis on e.g. ['indemnity', 'termination', 'payment']",
    )
    doc_type: Optional[str] = Field(default="contract", description="contract|agreement|pleading|order")


class DiffHunk(BaseModel):
    type: str           # added|removed|changed|unchanged
    content: str
    line_start: int
    line_end: int


class RiskChange(BaseModel):
    clause_type: str
    change_summary: str
    risk_direction: str     # increased|decreased|neutral
    severity: str           # low|medium|high


class CompareResult(BaseModel):
    summary: str
    total_changes: int
    additions: int
    deletions: int
    risk_changes: List[RiskChange]
    key_differences: List[str]
    recommendation: str
    diff_html: str          # HTML redline diff for frontend rendering
    powered_by: str


COMPARE_PROMPT = """You are a senior Indian legal drafting expert.

Compare the following two documents and provide a structured analysis.

DOCUMENT A ({label_a}):
{doc_a}

---

DOCUMENT B ({label_b}):
{doc_b}

{focus_str}

Analyse the changes and return EXACT JSON:

{{
  "summary": "<2-3 sentence executive summary of the changes>",
  "risk_changes": [
    {{
      "clause_type": "<type of clause e.g. Indemnity, Termination, Payment, Warranty>",
      "change_summary": "<what changed>",
      "risk_direction": "<increased|decreased|neutral>",
      "severity": "<low|medium|high>"
    }}
  ],
  "key_differences": [<list of 5-10 most important differences as plain text bullets>],
  "recommendation": "<overall recommendation — should Document B be accepted, negotiated, or rejected?>"
}}

Return ONLY the JSON, no other text."""


def _compute_diff_html(doc_a: str, doc_b: str) -> tuple[int, int, int, str]:
    """Compute line-level diff and return (total, additions, deletions, html)."""
    lines_a = doc_a.splitlines(keepends=True)
    lines_b = doc_b.splitlines(keepends=True)
    differ = difflib.HtmlDiff(wrapcolumn=80)
    html = differ.make_table(lines_a, lines_b, fromdesc="Original", todesc="Revised", context=True, numlines=3)

    # Count changes
    matcher = difflib.SequenceMatcher(None, lines_a, lines_b)
    additions = deletions = 0
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "insert":
            additions += j2 - j1
        elif tag == "delete":
            deletions += i2 - i1
        elif tag == "replace":
            additions += j2 - j1
            deletions += i2 - i1

    total = additions + deletions
    return total, additions, deletions, html


async def _call_llm(prompt: str) -> str:
    try:
        if settings.ai_provider == "claude":
            import anthropic
            client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
            msg = client.messages.create(
                model=settings.model_name,
                max_tokens=1500,
                messages=[{"role": "user", "content": prompt}],
            )
            return msg.content[0].text
        elif settings.ai_provider == "huggingface":
            import httpx
            headers = {"Authorization": f"Bearer {settings.huggingface_api_token}"}
            payload_data = {"inputs": prompt, "parameters": {"max_new_tokens": 1200}}
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(
                    f"https://api-inference.huggingface.co/models/{settings.model_name}",
                    json=payload_data, headers=headers,
                )
                result = resp.json()
                if isinstance(result, list) and result:
                    return result[0].get("generated_text", "")
        return "{}"
    except Exception as e:
        logger.warning(f"LLM call failed: {e}")
        return "{}"


def _parse_result(text: str) -> dict:
    import json, re
    try:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            return json.loads(match.group())
    except Exception:
        pass
    return {
        "summary": "AI analysis unavailable. Diff computed below.",
        "risk_changes": [],
        "key_differences": ["Unable to parse AI analysis. Please try again."],
        "recommendation": "Manual review required.",
    }


@router.post("/compare")
async def compare_documents(payload: DocCompareRequest, current_user: dict = Depends(require_pro_plan)):
    """
    G5 — Compare two documents with AI-powered redline analysis.

    Two-phase process:
    1. _compute_diff_html: structural diff via Python difflib (always runs, fast, no LLM)
    2. LLM analysis: identifies risk changes by clause type and produces an
       executive summary + Accept/Negotiate/Reject recommendation

    The diff_html field contains an HTML table suitable for direct rendering in the browser.
    """
    logger.info(f"Doc compare requested: type={payload.doc_type} focus={payload.focus_areas}")
    # Phase 1: structural diff (always succeeds, no network call)
    total, additions, deletions, diff_html = _compute_diff_html(payload.doc_a, payload.doc_b)
    logger.debug(f"Diff computed: {total} changes ({additions} added, {deletions} removed)")

    # Phase 2: LLM analysis — truncate docs to stay within token limits
    focus_str = ""
    if payload.focus_areas:
        focus_str = f"\nPay special attention to these areas: {', '.join(payload.focus_areas)}"

    prompt = COMPARE_PROMPT.format(
        label_a=payload.doc_a_label,
        label_b=payload.doc_b_label,
        doc_a=payload.doc_a[:3000],
        doc_b=payload.doc_b[:3000],
        focus_str=focus_str,
    )

    try:
        raw = await _call_llm(prompt)
        ai_result = _parse_result(raw)
        logger.info(f"Doc compare AI analysis complete: {len(ai_result.get('risk_changes', []))} risk changes found")
    except Exception as e:
        logger.error(f"Doc compare AI analysis failed: {e}")
        ai_result = {
            "summary": "Diff computed. AI analysis failed.",
            "risk_changes": [],
            "key_differences": [],
            "recommendation": "Review diff manually.",
        }

    return {
        "summary": ai_result.get("summary", ""),
        "total_changes": total,
        "additions": additions,
        "deletions": deletions,
        "risk_changes": ai_result.get("risk_changes", []),
        "key_differences": ai_result.get("key_differences", []),
        "recommendation": ai_result.get("recommendation", ""),
        "diff_html": diff_html,       # HTML redline table from difflib
        "powered_by": f"VakilAI ({settings.ai_provider})",
        "doc_a_label": payload.doc_a_label,
        "doc_b_label": payload.doc_b_label,
    }


@router.get("/status")
async def compare_status(current_user: dict = Depends(require_pro_plan)):
    return {
        "feature": "Document Comparison",
        "diff_engine": "Python difflib (always available)",
        "ai_analysis": settings.ai_provider,
        "ready": True,
    }
