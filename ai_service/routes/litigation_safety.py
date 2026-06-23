"""
G2 — Litigation Safety Check
Pre-filing risk analysis: limitation, jurisdiction, locus standi, costs,
alternative remedies, and procedural pitfalls.
"""

import logging
from fastapi import APIRouter, HTTPException, Depends
from middleware.auth_middleware import require_pro_plan
from pydantic import BaseModel, Field
from typing import Optional, List

from config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Models ─────────────────────────────────────────────────────────────────────

class SafetyCheckRequest(BaseModel):
    case_facts: str = Field(..., min_length=50, description="Case facts / dispute description")
    proposed_relief: str = Field(..., min_length=10, description="What relief is being sought")
    court: str = Field(..., description="Proposed court/forum to file in")
    cause_of_action_date: Optional[str] = Field("", description="Date when cause of action arose (ISO date)")
    practice_area: Optional[str] = Field("", description="Area of law")
    client_type: Optional[str] = Field("individual", description="individual|company|government")


class SafetyResult(BaseModel):
    overall_risk: str           # low | medium | high | critical
    risk_score: int             # 0-100
    limitation_status: str
    limitation_risk: str        # ok | warning | danger
    jurisdiction_ok: bool
    jurisdiction_notes: str
    locus_standi_notes: str
    procedural_risks: List[str]
    alternative_remedies: List[str]
    cost_estimate: str
    success_probability: str
    recommendations: List[str]
    powered_by: str


# ── Prompt ────────────────────────────────────────────────────────────────────

SAFETY_PROMPT = """You are a senior Indian litigation lawyer conducting a pre-filing safety check.

CASE FACTS:
{case_facts}

PROPOSED RELIEF:
{proposed_relief}

PROPOSED COURT/FORUM:
{court}

CAUSE OF ACTION DATE:
{coa_date}

PRACTICE AREA:
{practice_area}

CLIENT TYPE:
{client_type}

Conduct a thorough pre-filing safety check and respond in the following EXACT JSON format:

{{
  "overall_risk": "<low|medium|high|critical>",
  "risk_score": <0-100>,
  "limitation_status": "<explanation of whether limitation period is likely OK, expiring, or expired>",
  "limitation_risk": "<ok|warning|danger>",
  "jurisdiction_ok": <true|false>,
  "jurisdiction_notes": "<notes on whether chosen court has jurisdiction and is appropriate>",
  "locus_standi_notes": "<notes on whether client has locus standi to file>",
  "procedural_risks": [<list of specific procedural risks or pitfalls>],
  "alternative_remedies": [<list of alternative forums, remedies, or dispute resolution options>],
  "cost_estimate": "<realistic cost range in INR for this litigation>",
  "success_probability": "<estimated probability and brief reasoning>",
  "recommendations": [<list of concrete recommendations before filing>]
}}

Be specific to Indian law. Mention specific statutes, limitation periods under the Limitation Act 1963, and relevant procedural rules.
Return ONLY the JSON object, no other text."""


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
            payload = {"inputs": prompt, "parameters": {"max_new_tokens": 1200}}
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(
                    f"https://api-inference.huggingface.co/models/{settings.model_name}",
                    json=payload, headers=headers,
                )
                result = resp.json()
                if isinstance(result, list) and result:
                    return result[0].get("generated_text", "")
        return "{}"
    except Exception as e:
        logger.warning(f"LLM call failed: {e}")
        return "{}"


def _parse_safety_result(text: str, powered_by: str) -> dict:
    import json, re
    try:
        # Extract JSON block
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            data = json.loads(match.group())
            data["powered_by"] = powered_by
            return data
    except Exception:
        pass
    # Fallback
    return {
        "overall_risk": "medium",
        "risk_score": 50,
        "limitation_status": "Unable to determine — provide cause of action date.",
        "limitation_risk": "warning",
        "jurisdiction_ok": True,
        "jurisdiction_notes": "Manual verification required.",
        "locus_standi_notes": "Verify locus standi with a qualified advocate.",
        "procedural_risks": ["Verify limitation period under Limitation Act 1963.", "Check court fees and stamp duty."],
        "alternative_remedies": ["Mediation/Lok Adalat", "Arbitration if arbitration clause exists"],
        "cost_estimate": "INR 25,000 – 2,00,000 (varies by court and complexity)",
        "success_probability": "Cannot determine without detailed review.",
        "recommendations": ["Consult a qualified advocate before filing.", "Gather all documentary evidence."],
        "powered_by": powered_by,
    }


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/check")
async def litigation_safety_check(payload: SafetyCheckRequest, current_user: dict = Depends(require_pro_plan)):
    """
    G2 — Pre-filing litigation safety check.

    Runs the LLM against a structured prompt that covers:
    - Limitation period (Limitation Act 1963)
    - Jurisdiction of the chosen court/forum
    - Locus standi of the client
    - Procedural risks and pitfalls
    - Cost estimate and success probability
    - Alternative dispute resolution options
    - Actionable pre-filing recommendations

    Returns a structured JSON result with risk_score 0-100 and
    overall_level (low/medium/high/critical).
    """
    logger.info(f"Safety check requested: court={payload.court} practice={payload.practice_area}")
    prompt = SAFETY_PROMPT.format(
        case_facts=payload.case_facts[:2000],
        proposed_relief=payload.proposed_relief[:500],
        court=payload.court,
        coa_date=payload.cause_of_action_date or "Not provided",
        practice_area=payload.practice_area or "General",
        client_type=payload.client_type,
    )

    try:
        raw = await _call_llm(prompt)
        result = _parse_safety_result(raw, powered_by=f"VakilAI ({settings.ai_provider})")
        logger.info(f"Safety check complete: risk_level={result.get('overall_risk')} score={result.get('risk_score')}")
        return result
    except Exception as e:
        logger.error(f"Safety check error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def safety_status(current_user: dict = Depends(require_pro_plan)):
    return {
        "feature": "Litigation Safety Check",
        "ai_provider": settings.ai_provider,
        "ready": bool(settings.anthropic_api_key or settings.huggingface_api_token),
    }
