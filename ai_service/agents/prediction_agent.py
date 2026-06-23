"""
Predictive Case Outcome Agent.

Two modes (controlled by HF_PREDICTION_MODEL env var):
  1. Fine-tuned DistilBERT on HF Hub → use HF Inference API
  2. Fallback: few-shot Claude / HF LLM with RAG context

Training script: ai_service/training/train_outcome.py
"""

from __future__ import annotations

import json
import logging
import re
from typing import Optional

import httpx

from config import settings
from providers.factory import get_llm_provider
from rag.case_search import search_cases

logger = logging.getLogger(__name__)

OUTCOME_LABELS = [
    "Allowed",       # petition/appeal allowed
    "Dismissed",     # petition/appeal dismissed
    "Partly Allowed",
    "Settled",
    "Remanded",      # sent back to lower court
]


async def predict_outcome(
    case_facts: str,
    practice_area: str = "",
    court: str = "",
) -> dict:
    """
    Predict case outcome.
    Returns: { prediction, confidence, similar_cases, reasoning, disclaimer }
    """
    # Step 1: Find similar decided cases via RAG
    rag_query = f"{practice_area} {case_facts[:200]}"
    similar = await search_cases(rag_query, k=5, practice_area=practice_area)
    similar_cases = similar.get("results", [])

    # Step 2: Use fine-tuned model if available, else LLM
    if settings.hf_prediction_model:
        prediction, confidence = await _predict_with_finetuned_model(case_facts)
    else:
        prediction, confidence = await _predict_with_llm(case_facts, practice_area, court, similar_cases)

    # Step 3: Generate reasoning
    reasoning = await _generate_reasoning(case_facts, prediction, similar_cases)

    return {
        "prediction": prediction,
        "confidence": confidence,
        "confidence_label": _confidence_label(confidence),
        "similar_cases": [
            {
                "id": c.get("id"),
                "title": c.get("title"),
                "citation": c.get("citation"),
                "decision": c.get("decision"),
                "year": c.get("year"),
                "url": c.get("url"),
            }
            for c in similar_cases[:3]
        ],
        "reasoning": reasoning,
        "disclaimer": (
            "This prediction is AI-generated based on patterns in similar cases. "
            "It is NOT legal advice and should not be relied upon for any legal decisions. "
            "Consult a qualified advocate for case-specific guidance."
        ),
    }


async def _predict_with_finetuned_model(case_facts: str) -> tuple[str, float]:
    """Use fine-tuned DistilBERT on HF Hub via Inference API."""
    url = f"https://api-inference.huggingface.co/models/{settings.hf_prediction_model}"
    headers = {"Authorization": f"Bearer {settings.huggingface_api_token}"}
    payload = {"inputs": case_facts[:512]}

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, list) and data:
                # Standard HF classification output: [{label, score}]
                top = sorted(data[0], key=lambda x: x["score"], reverse=True)[0]
                return top["label"], round(top["score"], 3)
        except Exception as e:
            logger.error(f"Fine-tuned model prediction failed: {e}")
    return "Uncertain", 0.5


async def _predict_with_llm(
    case_facts: str,
    practice_area: str,
    court: str,
    similar_cases: list[dict],
) -> tuple[str, float]:
    """Predict using LLM with RAG context as few-shot examples."""
    similar_text = "\n".join(
        f"- {c.get('title', '')} ({c.get('year', '')}): {c.get('decision', '')}"
        for c in similar_cases[:3]
    )

    provider = get_llm_provider()
    messages = [
        {
            "role": "system",
            "content": (
                f"You are an expert in Indian {practice_area or 'law'}. "
                "Based on the case facts and similar precedents, predict the likely outcome. "
                f"Choose ONE from: {', '.join(OUTCOME_LABELS)}. "
                "Also estimate confidence 0.0-1.0. "
                'Return JSON: {"prediction": "...", "confidence": 0.XX}'
            ),
        },
        {
            "role": "user",
            "content": (
                f"Case facts: {case_facts[:1000]}\n\n"
                f"Court: {court or 'Not specified'}\n\n"
                f"Similar decided cases:\n{similar_text or 'No similar cases found'}"
            ),
        },
    ]
    try:
        result = await provider.complete(messages, max_tokens=200, temperature=0.1)
        match = re.search(r"\{.*\}", result, re.DOTALL)
        if match:
            data = json.loads(match.group())
            pred = data.get("prediction", "Uncertain")
            conf = float(data.get("confidence", 0.5))
            return pred, round(min(max(conf, 0.0), 1.0), 3)
    except Exception as e:
        logger.error(f"LLM prediction failed: {e}")
    return "Uncertain", 0.5


async def _generate_reasoning(case_facts: str, prediction: str, similar_cases: list[dict]) -> str:
    provider = get_llm_provider()
    precedents = "\n".join(
        f"• {c.get('title', '')} — {c.get('decision', '')}" for c in similar_cases[:3]
    )
    messages = [
        {
            "role": "system",
            "content": "Explain in 2-3 sentences why this Indian court case is likely to result in the predicted outcome, citing the similar precedents.",
        },
        {
            "role": "user",
            "content": f"Facts: {case_facts[:500]}\nPredicted outcome: {prediction}\nPrecedents:\n{precedents}",
        },
    ]
    try:
        return await provider.complete(messages, max_tokens=300, temperature=0.3)
    except Exception:
        return f"Based on similar cases, the predicted outcome is '{prediction}'."


def _confidence_label(confidence: float) -> str:
    if confidence >= 0.8:
        return "High"
    elif confidence >= 0.6:
        return "Medium"
    return "Low"
