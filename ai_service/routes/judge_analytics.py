"""
G1 — Judge Analytics
Analyse judicial tendencies, grant rates, and preferred legal reasoning
for any judge or court using the FAISS case index.
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

class JudgeAnalyticsRequest(BaseModel):
    judge_name: str = Field(..., min_length=2, description="Judge name e.g. 'Justice D.Y. Chandrachud'")
    court: Optional[str] = Field("", description="Court name to narrow search")
    practice_area: Optional[str] = Field("", description="Area of law for focused analysis")
    top_k: int = Field(default=20, ge=5, le=100, description="Cases to sample for analysis")


class CourtTendencyRequest(BaseModel):
    court: str = Field(..., min_length=2)
    practice_area: Optional[str] = Field("")
    years: Optional[int] = Field(5, ge=1, le=20, description="Look back N years")


# ── LLM helper ────────────────────────────────────────────────────────────────

async def _llm_analyse(prompt: str) -> str:
    """Route to configured LLM provider."""
    try:
        if settings.ai_provider == "claude":
            import anthropic
            client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
            msg = client.messages.create(
                model=settings.model_name,
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
            )
            return msg.content[0].text
        elif settings.ai_provider == "huggingface":
            import httpx
            headers = {"Authorization": f"Bearer {settings.huggingface_api_token}"}
            payload = {"inputs": prompt, "parameters": {"max_new_tokens": 800}}
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(
                    f"https://api-inference.huggingface.co/models/{settings.model_name}",
                    json=payload, headers=headers,
                )
                result = resp.json()
                if isinstance(result, list) and result:
                    return result[0].get("generated_text", "")
        return "Analysis unavailable — LLM provider not configured."
    except Exception as e:
        logger.warning(f"LLM call failed: {e}")
        return "Analysis unavailable."


def _build_judge_prompt(judge_name: str, court: str, practice_area: str, cases_summary: str) -> str:
    area_str = f" in {practice_area} matters" if practice_area else ""
    court_str = f" at {court}" if court else ""
    return f"""You are a senior legal researcher analysing Indian judicial data.

Analyse the judicial tendencies of {judge_name}{court_str}{area_str} based on the following case summaries:

{cases_summary}

Provide a structured analysis with these sections:
1. GRANT RATE: Estimated percentage of petitions/appeals granted or upheld
2. KEY TENDENCIES: 3-5 bullet points on observable patterns in reasoning or outcomes
3. PREFERRED REASONING: Legal doctrines or principles frequently applied
4. NOTABLE AREAS: Practice areas where the judge has strong/distinctive views
5. STRATEGIC TIPS: 2-3 practical tips for advocates appearing before this judge
6. DISCLAIMER: Note that this is AI analysis based on available data and may not reflect current views.

Be specific and cite observable patterns. Format each section clearly."""


def _build_court_prompt(court: str, practice_area: str, years: int, cases_summary: str) -> str:
    area_str = f" in {practice_area}" if practice_area else ""
    return f"""You are a senior legal researcher analysing Indian court data.

Analyse the judicial tendencies of {court}{area_str} over the past {years} years based on:

{cases_summary}

Provide:
1. OUTCOME STATISTICS: Estimated grant/allow rates
2. BENCH PREFERENCES: Common reasoning patterns observed
3. HOT TOPICS: Most litigated issues in this period
4. PROCEDURAL NOTES: Any notable procedural tendencies
5. PRACTITIONER TIPS: Strategic insights for appearing counsel

Format each section clearly with bullet points."""


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/judge")
async def analyse_judge(payload: JudgeAnalyticsRequest, current_user: dict = Depends(require_pro_plan)):
    """Analyse a specific judge's tendencies from the case index."""
    try:
        from rag.vector_store import case_store

        # Search for cases by this judge
        query = f"judge {payload.judge_name} {payload.court} {payload.practice_area}".strip()
        results = case_store.search(query, k=payload.top_k)

        if not results:
            # Return a demo profile when no cases are indexed
            return {
                "judge_name": payload.judge_name,
                "court": payload.court,
                "cases_sampled": 0,
                "analysis": {
                    "grant_rate": "Insufficient data",
                    "key_tendencies": ["Insufficient indexed cases to derive tendencies."],
                    "preferred_reasoning": [],
                    "notable_areas": [],
                    "strategic_tips": ["Ingest NyayaAnumana dataset for richer analytics."],
                },
                "powered_by": "VakilAI (no cases indexed)",
                "note": "Ingest cases via the NyayaAnumana ingester to enable real analytics.",
            }

        cases_summary = "\n\n".join(
            f"Case {i+1}: {r.get('case_name', 'Unknown')} | Court: {r.get('court', '')} | "
            f"Decision: {r.get('decision', '')} | Summary: {r.get('summary', r.get('facts', ''))[:300]}"
            for i, r in enumerate(results)
        )

        prompt = _build_judge_prompt(payload.judge_name, payload.court, payload.practice_area, cases_summary)
        analysis_text = await _llm_analyse(prompt)

        return {
            "judge_name": payload.judge_name,
            "court": payload.court or "All Courts",
            "practice_area": payload.practice_area or "All Areas",
            "cases_sampled": len(results),
            "raw_analysis": analysis_text,
            "powered_by": f"VakilAI ({settings.ai_provider})",
        }

    except Exception as e:
        logger.error(f"Judge analytics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/court")
async def analyse_court(payload: CourtTendencyRequest, current_user: dict = Depends(require_pro_plan)):
    """Analyse a court's tendencies over a given period."""
    try:
        from rag.vector_store import case_store

        query = f"court {payload.court} {payload.practice_area}".strip()
        results = case_store.search(query, k=50)

        if not results:
            return {
                "court": payload.court,
                "cases_sampled": 0,
                "analysis": "Insufficient indexed cases. Ingest NyayaAnumana dataset for analytics.",
                "powered_by": "VakilAI",
            }

        cases_summary = "\n\n".join(
            f"Case {i+1}: {r.get('case_name', 'Unknown')} | Decision: {r.get('decision', '')} | "
            f"Summary: {r.get('summary', r.get('facts', ''))[:200]}"
            for i, r in enumerate(results[:30])
        )

        prompt = _build_court_prompt(payload.court, payload.practice_area, payload.years, cases_summary)
        analysis_text = await _llm_analyse(prompt)

        return {
            "court": payload.court,
            "practice_area": payload.practice_area or "All Areas",
            "years": payload.years,
            "cases_sampled": len(results),
            "raw_analysis": analysis_text,
            "powered_by": f"VakilAI ({settings.ai_provider})",
        }

    except Exception as e:
        logger.error(f"Court analytics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def analytics_status(current_user: dict = Depends(require_pro_plan)):
    """Health check and feature status."""
    try:
        from rag.vector_store import case_store
        index_size = case_store.index.ntotal if case_store.index else 0
    except Exception:
        index_size = 0
    return {
        "feature": "Judge Analytics",
        "index_size": index_size,
        "ai_provider": settings.ai_provider,
        "ready": index_size > 0,
        "note": "Ingest NyayaAnumana dataset via `python -m rag.nyayaanumana_ingester` for best results.",
    }
