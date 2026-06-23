"""
MatchingAgent — AI-powered lawyer-client matching with complexity scoring.
"""

from __future__ import annotations

import json
import re

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from config import settings


def get_llm() -> ChatAnthropic:
    return ChatAnthropic(
        model=settings.model_name,
        api_key=settings.anthropic_api_key,
        temperature=0.1,
        max_tokens=1000,
    )


async def score_lawyer_match(case_description: str, lawyer_profile: dict) -> dict:
    """
    Score the match between a case and a lawyer profile.
    Returns {"score": 0-1, "reason": "..."}
    """
    llm = get_llm()
    profile_str = json.dumps({
        "name": lawyer_profile.get("name"),
        "practice_areas": lawyer_profile.get("practice_areas", []),
        "experience_years": lawyer_profile.get("experience_years"),
        "courts": lawyer_profile.get("courts", []),
        "location": lawyer_profile.get("location"),
        "languages": lawyer_profile.get("languages", []),
    }, indent=2)

    response = await llm.ainvoke([
        SystemMessage(content="""You are a legal case-to-lawyer matching expert for India.
Score how well this lawyer matches the case description.
Return JSON: {"score": 0.0-1.0, "reason": "1-sentence explanation of match quality"}
Return ONLY valid JSON."""),
        HumanMessage(content=f"Case description:\n{case_description}\n\nLawyer profile:\n{profile_str}"),
    ])

    try:
        content = response.content.strip()
        match = re.search(r'\{.*\}', content, re.DOTALL)
        data = json.loads(match.group()) if match else {}
        return {"score": float(data.get("score", 0.5)), "reason": data.get("reason", "")}
    except Exception:
        return {"score": 0.5, "reason": "Unable to compute match score."}


async def assess_case_complexity(case_description: str, practice_area: str | None = None) -> dict:
    """
    Assess complexity of a case and recommend lawyer tier.
    Returns {"complexity": "low|medium|high", "score": 0-1, "factors": [...], "recommended_tier": "junior|senior|specialist"}
    """
    llm = get_llm()
    response = await llm.ainvoke([
        SystemMessage(content="""You are a legal case complexity assessor for India.
Assess the complexity of the described legal matter.
Return JSON:
{
  "complexity": "low|medium|high",
  "score": 0.0-1.0,
  "factors": ["factor1", "factor2"],
  "recommended_tier": "junior|senior|specialist",
  "estimated_duration_months": number,
  "recommended_courts": ["court1"],
  "notes": "brief note"
}
Return ONLY valid JSON."""),
        HumanMessage(content=f"Practice area: {practice_area or 'Unknown'}\n\nCase:\n{case_description}"),
    ])

    try:
        content = response.content.strip()
        match = re.search(r'\{.*\}', content, re.DOTALL)
        return json.loads(match.group()) if match else {}
    except Exception:
        return {
            "complexity": "medium",
            "score": 0.5,
            "factors": ["Unable to assess"],
            "recommended_tier": "senior",
            "notes": "Please provide more case details for accurate assessment.",
        }
