"""
G10 — Case Risk Scoring
Compute a composite risk score for a case: factual strength,
legal merit, procedural posture, and enforcement risk.
Returns a breakdown with colour-coded risk levels.
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

class RiskScoreRequest(BaseModel):
    case_facts: str = Field(..., min_length=50)
    client_position: str = Field(..., description="plaintiff|defendant|petitioner|respondent|appellant")
    practice_area: Optional[str] = Field("")
    court: Optional[str] = Field("")
    relief_sought: Optional[str] = Field("")
    opposing_strength: Optional[str] = Field("", description="Brief description of opposing party's position")


class RiskDimension(BaseModel):
    name: str
    score: int            # 0-100 (higher = more risk)
    level: str            # low|medium|high|critical
    explanation: str


class RiskScoreResult(BaseModel):
    overall_score: int
    overall_level: str
    dimensions: List[RiskDimension]
    key_risks: List[str]
    mitigants: List[str]
    recommendation: str
    powered_by: str


RISK_PROMPT = """You are a senior Indian litigator conducting a case risk assessment.

CASE FACTS:
{case_facts}

CLIENT POSITION:
{client_position}

PRACTICE AREA:
{practice_area}

COURT:
{court}

RELIEF SOUGHT:
{relief}

OPPOSING POSITION:
{opposing}

Assess the following risk dimensions and return EXACT JSON:

{{
  "overall_score": <0-100, higher=more risky>,
  "overall_level": "<low|medium|high|critical>",
  "dimensions": [
    {{
      "name": "Factual Strength",
      "score": <0-100>,
      "level": "<low|medium|high|critical>",
      "explanation": "<1-2 sentence explanation>"
    }},
    {{
      "name": "Legal Merit",
      "score": <0-100>,
      "level": "<low|medium|high|critical>",
      "explanation": "<1-2 sentence explanation>"
    }},
    {{
      "name": "Limitation & Procedural",
      "score": <0-100>,
      "level": "<low|medium|high|critical>",
      "explanation": "<1-2 sentence explanation>"
    }},
    {{
      "name": "Enforcement Risk",
      "score": <0-100>,
      "level": "<low|medium|high|critical>",
      "explanation": "<1-2 sentence explanation>"
    }},
    {{
      "name": "Opposing Party Strength",
      "score": <0-100>,
      "level": "<low|medium|high|critical>",
      "explanation": "<1-2 sentence explanation>"
    }}
  ],
  "key_risks": [<list of 3-5 specific risks>],
  "mitigants": [<list of 3-5 ways to reduce risk>],
  "recommendation": "<1-2 sentence overall strategic recommendation>"
}}

Return ONLY the JSON, no other text."""


async def _call_llm(prompt: str) -> str:
    try:
        if settings.ai_provider == "claude":
            import anthropic
            client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
            msg = client.messages.create(
                model=settings.model_name,
                max_tokens=1200,
                messages=[{"role": "user", "content": prompt}],
            )
            return msg.content[0].text
        elif settings.ai_provider == "huggingface":
            import httpx
            headers = {"Authorization": f"Bearer {settings.huggingface_api_token}"}
            payload_data = {"inputs": prompt, "parameters": {"max_new_tokens": 1000}}
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


def _parse_result(text: str, powered_by: str) -> dict:
    import json, re
    try:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            data = json.loads(match.group())
            data["powered_by"] = powered_by
            return data
    except Exception:
        pass
    return {
        "overall_score": 50,
        "overall_level": "medium",
        "dimensions": [
            {"name": "Factual Strength", "score": 50, "level": "medium", "explanation": "Unable to assess."},
            {"name": "Legal Merit",      "score": 50, "level": "medium", "explanation": "Unable to assess."},
            {"name": "Limitation & Procedural", "score": 50, "level": "medium", "explanation": "Unable to assess."},
            {"name": "Enforcement Risk", "score": 50, "level": "medium", "explanation": "Unable to assess."},
            {"name": "Opposing Party Strength", "score": 50, "level": "medium", "explanation": "Unable to assess."},
        ],
        "key_risks": ["Unable to analyse — please try again."],
        "mitigants": ["Consult a qualified advocate."],
        "recommendation": "Manual risk assessment required.",
        "powered_by": powered_by,
    }


@router.post("/score")
async def compute_risk_score(payload: RiskScoreRequest, current_user: dict = Depends(require_pro_plan)):
    """
    G10 — Compute a composite risk score for a case across 5 dimensions:
    1. Factual Strength
    2. Legal Merit
    3. Limitation & Procedural
    4. Enforcement Risk
    5. Opposing Party Strength

    Each dimension is scored 0-100 (higher = more risky) and combined
    into an overall_score with an overall_level (low/medium/high/critical).
    """
    logger.info(f"Risk score requested: position={payload.client_position} area={payload.practice_area}")
    prompt = RISK_PROMPT.format(
        case_facts=payload.case_facts[:2000],
        client_position=payload.client_position,
        practice_area=payload.practice_area or "General",
        court=payload.court or "Not specified",
        relief=payload.relief_sought or "Not specified",
        opposing=payload.opposing_strength or "Not provided",
    )
    try:
        raw = await _call_llm(prompt)
        result = _parse_result(raw, powered_by=f"VakilAI ({settings.ai_provider})")
        logger.info(f"Risk score complete: overall={result.get('overall_score')} level={result.get('overall_level')}")
        return result
    except Exception as e:
        logger.error(f"Risk score error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def risk_status(current_user: dict = Depends(require_pro_plan)):
    return {
        "feature": "Case Risk Scoring",
        "ai_provider": settings.ai_provider,
        "ready": bool(settings.anthropic_api_key or settings.huggingface_api_token),
    }
