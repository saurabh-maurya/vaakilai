"""
Pluggable generation + embedding layer for VaakilAI.

`get_llm()` returns a priority chain. Aalap (Indian-legal) is tried FIRST for
maximum legal coverage, then the configured provider priority:

    Aalap  →  Claude  →  Groq  →  Gemini  →  hosted (HF router / Together / …)  →  Ollama

Order (after Aalap) comes from settings.llm_provider_priority. A provider is
included only when it is configured (has an API key / is enabled). A provider
that fails is skipped for a short cooldown so it never slows later requests.

    from llm import get_llm, LLMUnavailable
    text = await get_llm().complete(messages)

Embeddings:

    from llm import get_embedder
    vecs = await get_embedder().embed(texts)
"""

from __future__ import annotations

import logging

from config import settings
from providers.base import BaseLLMProvider

from .chain import ChainLLMProvider, LLMUnavailable
from .chat import AalapProvider, ClaudeChatProvider, OpenAICompatProvider
from .embeddings import get_embedder

logger = logging.getLogger(__name__)


def _build_aalap():
    if not settings.aalap_enabled:
        return None
    backend = (settings.aalap_backend or "hosted").lower()
    if backend == "ollama":
        return AalapProvider("ollama") if settings.ollama_enabled else None
    return AalapProvider("hosted") if settings.huggingface_api_token else None


def _build_provider(name: str):
    name = name.lower()
    if name == "claude":
        return ClaudeChatProvider() if settings.anthropic_api_key else None
    if name == "groq":
        return (OpenAICompatProvider(settings.groq_base_url, settings.groq_api_key, settings.groq_model, "groq")
                if settings.groq_api_key else None)
    if name == "gemini":
        return (OpenAICompatProvider(settings.gemini_base_url, settings.gemini_api_key, settings.gemini_model, "gemini")
                if settings.gemini_api_key else None)
    if name == "hosted":
        return (OpenAICompatProvider(settings.hosted_llm_base_url, settings.hosted_llm_api_key,
                                     settings.hosted_llm_model, "hosted")
                if settings.hosted_llm_api_key else None)
    if name == "ollama":
        if settings.ollama_enabled:
            from providers.ollama_provider import OllamaLLMProvider
            return OllamaLLMProvider()
        return None
    logger.warning("Unknown LLM provider in priority list: %s", name)
    return None


def _entries() -> list[tuple[str, BaseLLMProvider]]:
    entries: list[tuple[str, BaseLLMProvider]] = []
    aalap = _build_aalap()
    if aalap is not None:
        entries.append(("aalap", aalap))
    for name in (p.strip() for p in settings.llm_provider_priority.split(",") if p.strip()):
        prov = _build_provider(name)
        if prov is not None:
            entries.append((name.lower(), prov))
    return entries


def get_llm() -> BaseLLMProvider:
    """Priority chain: Aalap → configured providers. Raises LLMUnavailable if none configured."""
    entries = _entries()
    if not entries:
        raise LLMUnavailable(
            "No LLM providers configured. Set one of ANTHROPIC_API_KEY / GROQ_API_KEY / "
            "GEMINI_API_KEY / HOSTED_LLM_API_KEY (or enable Ollama / Aalap)."
        )
    return ChainLLMProvider(entries)


def describe() -> dict:
    """Human-readable status of the active chain (used by /status endpoints)."""
    chain = [name for name, _ in _entries()]
    return {
        "chain": chain,
        "aalap_enabled": settings.aalap_enabled,
        "aalap_backend": settings.aalap_backend,
        "claude_model": settings.claude_model,
        "groq_model": settings.groq_model if settings.groq_api_key else None,
        "gemini_model": settings.gemini_model if settings.gemini_api_key else None,
        "hosted_model": settings.hosted_llm_model if settings.hosted_llm_api_key else None,
        "ollama_enabled": settings.ollama_enabled,
        "embedding_backend": settings.embedding_backend,
        "uses_claude": "claude" in chain,
        "ready": bool(chain),
    }


def active_backend() -> str:
    entries = _entries()
    return entries[0][0] if entries else "none"


__all__ = ["get_llm", "get_embedder", "describe", "active_backend", "LLMUnavailable"]
