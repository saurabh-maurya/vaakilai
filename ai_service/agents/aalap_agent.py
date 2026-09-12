"""
Aalap Agent — Indian legal task specialist.

Uses OpenNyAI's Aalap (Mistral 7B fine-tuned on 22k Indian legal instructions)
for four specific tasks:
  1. Argument Generation   — petitioner + respondent arguments from facts/statutes
  2. Issue Spotting        — identify legal issues from case facts
  3. Event Timeline        — extract chronological events from FIR/case description
  4. Statute Breakdown     — element-by-element analysis of any Indian statute section

When AALAP_ENABLED=True  → routes to opennyaiorg/Aalap-Mistral-7B-v0.1-bf16 via HF API
When AALAP_ENABLED=False → falls back to the configured general LLM provider (Claude/Mistral/Phi)

Reference: https://arxiv.org/pdf/2402.01758
Model:     https://huggingface.co/opennyaiorg/Aalap-Mistral-7B-v0.1-bf16
License:   Apache-2.0
"""

from __future__ import annotations

import logging
import re
from typing import Optional

import httpx

from config import settings
from llm import get_llm as get_llm_provider

logger = logging.getLogger(__name__)

HF_API_BASE = "https://api-inference.huggingface.co/models"


# ── Core Aalap caller ─────────────────────────────────────────────────────────

async def _call_aalap(prompt: str, max_tokens: int = 1024) -> str:
    """
    Run through the provider chain, which tries Aalap FIRST (when enabled) and
    falls over to Claude → Groq → Gemini → hosted. Single source of truth in llm/.
    """
    from llm import LLMUnavailable
    messages = [
        {"role": "system", "content": "You are an expert Indian legal assistant with deep knowledge of Indian law, statutes, and court procedures."},
        {"role": "user", "content": prompt},
    ]
    try:
        return await get_llm_provider().complete(messages, max_tokens=max_tokens, temperature=0.2)
    except LLMUnavailable as e:
        logger.warning(f"No LLM provider available for Aalap task: {e}")
        return ""


# ── Task 1: Argument Generation ───────────────────────────────────────────────

async def generate_arguments(
    case_facts: str,
    issues: str = "",
    statutes: str = "",
    practice_area: str = "",
) -> dict:
    """
    Generate structured petitioner arguments and respondent counter-arguments.
    Returns: { petitioner_arguments: [...], respondent_arguments: [...], summary: str }
    """
    context_parts = [f"Case Facts:\n{case_facts}"]
    if issues:
        context_parts.append(f"Legal Issues:\n{issues}")
    if statutes:
        context_parts.append(f"Relevant Statutes/Sections:\n{statutes}")
    if practice_area:
        context_parts.append(f"Area of Law: {practice_area}")

    prompt = f"""{chr(10).join(context_parts)}

Based on the above, generate structured legal arguments in Indian court format:

SECTION A — PETITIONER/APPELLANT ARGUMENTS:
(Numbered list of arguments supporting the petitioner's case, citing relevant statutes and legal principles)

SECTION B — RESPONDENT/DEFENDANT COUNTER-ARGUMENTS:
(Numbered list of counter-arguments, with rebuttals to petitioner's points)

SECTION C — KEY LEGAL PRINCIPLES:
(2-3 key legal principles from Indian case law that govern this dispute)"""

    raw = await _call_aalap(prompt, max_tokens=1200)

    # Parse sections
    pet_args = _extract_section(raw, "SECTION A", "SECTION B")
    res_args = _extract_section(raw, "SECTION B", "SECTION C")
    principles = _extract_section(raw, "SECTION C", None)

    return {
        "petitioner_arguments": _parse_numbered_list(pet_args),
        "respondent_arguments": _parse_numbered_list(res_args),
        "key_principles": _parse_numbered_list(principles),
        "raw_output": raw,
        "powered_by": "Aalap (OpenNyAI Mistral 7B)" if settings.aalap_enabled else "General LLM",
    }


# ── Task 2: Issue Spotting ────────────────────────────────────────────────────

async def spot_issues(
    case_facts: str,
    practice_area: str = "",
    court: str = "",
) -> dict:
    """
    Identify key legal issues that need to be decided by the court.
    Returns: { issues: [...], primary_issue: str, applicable_laws: [...] }
    """
    context = f"Case Facts:\n{case_facts}"
    if practice_area:
        context += f"\nArea of Law: {practice_area}"
    if court:
        context += f"\nCourt: {court}"

    prompt = f"""{context}

Identify all key legal issues from the above facts that need to be decided by the court. For each issue:
- State the issue clearly as a legal question
- Identify the applicable Indian statute, section, or constitutional provision
- Indicate whether it is a question of fact, law, or mixed

Format:
ISSUE 1: [State the legal question]
Applicable Law: [Statute/Section/Article]
Nature: [Fact / Law / Mixed]

ISSUE 2: ...

PRIMARY ISSUE: [The most critical issue for determination]

APPLICABLE LAWS: [List all relevant statutes and sections]"""

    raw = await _call_aalap(prompt, max_tokens=800)

    issues = _parse_issues_list(raw)
    primary = _extract_line(raw, "PRIMARY ISSUE:")
    laws = _extract_line(raw, "APPLICABLE LAWS:")

    return {
        "issues": issues,
        "primary_issue": primary or (issues[0] if issues else ""),
        "applicable_laws": [l.strip() for l in laws.split(",") if l.strip()] if laws else [],
        "total_issues": len(issues),
        "raw_output": raw,
        "powered_by": "Aalap (OpenNyAI Mistral 7B)" if settings.aalap_enabled else "General LLM",
    }


# ── Task 3: Event Timeline ────────────────────────────────────────────────────

async def extract_event_timeline(
    case_description: str,
    source_type: str = "case",  # "case" | "fir"
) -> dict:
    """
    Extract chronological event timeline from case facts or FIR.
    Returns: { events: [{date, event, significance}], duration_days: int }
    """
    source_label = "First Information Report (FIR)" if source_type == "fir" else "case description/judgment"

    prompt = f"""Extract a complete chronological timeline of all important events and dates from the following {source_label}.

{case_description}

For each event, provide:
DATE: [DD/MM/YYYY or approximate date]
EVENT: [What happened — be specific]
SIGNIFICANCE: [Legal/factual significance of this event]

List ALL events chronologically from earliest to latest. Include filing dates, hearing dates, orders, incidents, and any relevant dates mentioned."""

    raw = await _call_aalap(prompt, max_tokens=1000)
    events = _parse_timeline_events(raw)

    return {
        "events": events,
        "total_events": len(events),
        "source_type": source_type,
        "raw_output": raw,
        "powered_by": "Aalap (OpenNyAI Mistral 7B)" if settings.aalap_enabled else "General LLM",
    }


# ── Task 4: Statute Breakdown ─────────────────────────────────────────────────

async def breakdown_statute(
    statute_text: str,
    statute_name: str = "",
) -> dict:
    """
    Break a statute/section into elements/ingredients of proof.
    Returns: { ingredients: [...], burden_of_proof: str, exceptions: [...], punishment: str }
    """
    header = f"Statute: {statute_name}\n\n" if statute_name else ""

    prompt = f"""{header}Statute Text:
{statute_text}

Provide a detailed legal analysis of this Indian statute/section:

ESSENTIAL INGREDIENTS:
(Number each ingredient that the prosecution/complainant must prove)

BURDEN OF PROOF:
(Who bears the burden and to what standard — beyond reasonable doubt / balance of probabilities)

EXCEPTIONS & DEFENCES:
(Any exceptions, provisos, or defences available to the accused/respondent)

PUNISHMENT/REMEDY:
(The prescribed punishment, penalty, or civil remedy)

LANDMARK CASES:
(2-3 key Supreme Court/High Court judgments interpreting this provision)"""

    raw = await _call_aalap(prompt, max_tokens=1000)

    return {
        "statute_name": statute_name,
        "ingredients": _parse_numbered_list(_extract_section(raw, "ESSENTIAL INGREDIENTS:", "BURDEN OF PROOF:")),
        "burden_of_proof": _clean_markdown(_extract_section(raw, "BURDEN OF PROOF:", "EXCEPTIONS")),
        "exceptions": _parse_numbered_list(_extract_section(raw, "EXCEPTIONS", "PUNISHMENT")),
        "punishment": _clean_markdown(_extract_section(raw, "PUNISHMENT/REMEDY:", "LANDMARK")),
        "landmark_cases": _parse_numbered_list(_extract_section(raw, "LANDMARK CASES:", None)),
        "raw_output": raw,
        "powered_by": "Aalap (OpenNyAI Mistral 7B)" if settings.aalap_enabled else "General LLM",
    }


# ── Parsing helpers ───────────────────────────────────────────────────────────

def _marker_pattern(marker: str) -> str:
    """
    Build a marker regex tolerant of how models actually format section
    headers — e.g. "### **1. ESSENTIAL INGREDIENTS**" instead of the plain
    "ESSENTIAL INGREDIENTS:" the prompt asked for. Matches optional markdown
    heading/bullet/number noise around the label and an optional colon.
    """
    core = marker.rstrip(":").strip()
    return r"[#\*\s]*\d*[\.\)]?\s*\*{0,2}\s*" + re.escape(core) + r"\s*\*{0,2}\s*:?"


def _extract_section(text: str, start_marker: str, end_marker: Optional[str]) -> str:
    """Extract text between two markers (case-insensitive)."""
    start_m = re.search(_marker_pattern(start_marker), text, re.IGNORECASE)
    if not start_m:
        return text  # fallback: return all

    start_idx = start_m.end()
    if end_marker:
        end_m = re.search(_marker_pattern(end_marker), text[start_idx:], re.IGNORECASE)
        if end_m:
            return text[start_idx: start_idx + end_m.start()].strip()
    return text[start_idx:].strip()


def _clean_markdown(text: str) -> str:
    """Strip markdown emphasis markers — the frontend renders these fields as
    plain text, so unstripped **bold**/*italic* asterisks leak through literally."""
    text = re.sub(r"\*{1,2}(.+?)\*{1,2}", r"\1", text).strip()
    # Also drop any unpaired leading/trailing asterisks left when a bold span
    # opened or closed outside the extracted slice (e.g. "**ISSUE 1: ...**"
    # where the captured group starts after "ISSUE 1:", inside the bold span).
    return text.strip("* ").strip()


def _parse_numbered_list(text: str) -> list[str]:
    """Parse numbered list items from text."""
    if not text:
        return []
    items = re.split(r"\n\s*\d+[\.\)]\s*", "\n" + text)
    return [_clean_markdown(i) for i in items if i.strip()]


def _parse_issues_list(text: str) -> list[str]:
    """Parse ISSUE N: entries from text."""
    if not text or not text.strip():
        return []
    issues = re.findall(r"ISSUE\s*\d+:\s*(.+?)(?=ISSUE\s*\d+:|PRIMARY ISSUE:|$)", text, re.IGNORECASE | re.DOTALL)
    cleaned = []
    for issue in issues:
        # The issue statement may start on the line right after "ISSUE N:"
        # rather than inline, so skip blank lines before taking the first one.
        lines = [l.strip() for l in issue.split("\n") if l.strip()]
        if lines:
            cleaned.append(_clean_markdown(lines[0]))
    return cleaned if cleaned else [text.strip()[:200]]


def _parse_timeline_events(text: str) -> list[dict]:
    """Parse DATE/EVENT/SIGNIFICANCE triplets from timeline text."""
    events = []
    # Some models wrap the labels in markdown bold (**DATE:**) — strip that
    # decoration first so the plain-text label matching below still works.
    text = re.sub(r"\*{1,2}\s*(DATE|EVENT|SIGNIFICANCE)\s*:\s*\*{0,2}", r"\1:", text, flags=re.IGNORECASE)
    # Try structured parse first
    # A value stops at a newline, or at the next DATE:/EVENT:/SIGNIFICANCE:
    # label if the model ran fields together on one line instead of separate lines.
    field_end = r"(?=\n|\s*(?:DATE|EVENT|SIGNIFICANCE):|$)"
    blocks = re.split(r"\n(?=\s*DATE:)", text, flags=re.IGNORECASE)
    for block in blocks:
        date_m = re.search(r"DATE:\s*(.+?)" + field_end, block, re.IGNORECASE)
        event_m = re.search(r"EVENT:\s*(.+?)" + field_end, block, re.IGNORECASE)
        sig_m = re.search(r"SIGNIFICANCE:\s*(.+?)" + field_end, block, re.IGNORECASE)
        # A preamble/intro paragraph can end up sharing a block with the first
        # real DATE: field when the model doesn't put DATE: at a line start —
        # skip anything before the DATE: label so only the field values remain.
        if date_m:
            block = block[date_m.start():]
            date_m = re.search(r"DATE:\s*(.+?)" + field_end, block, re.IGNORECASE)
            event_m = re.search(r"EVENT:\s*(.+?)" + field_end, block, re.IGNORECASE)
            sig_m = re.search(r"SIGNIFICANCE:\s*(.+?)" + field_end, block, re.IGNORECASE)
        if date_m or event_m:
            events.append({
                "date": date_m.group(1).strip(" *\t") if date_m else "",
                "event": _clean_markdown(event_m.group(1)) if event_m else block.strip(" *\t\n")[:200],
                "significance": _clean_markdown(sig_m.group(1)) if sig_m else "",
            })

    # Fallback: numbered list
    if not events:
        items = re.split(r"\n\s*\d+[\.\)]\s*", "\n" + text)
        for item in items:
            if item.strip():
                events.append({"date": "", "event": item.strip(), "significance": ""})
    return events


def _extract_line(text: str, prefix: str) -> str:
    """Extract text after a prefix on the same line."""
    m = re.search(re.escape(prefix) + r"\s*(.+)", text, re.IGNORECASE)
    return m.group(1).strip() if m else ""
