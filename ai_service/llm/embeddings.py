"""
Embedding provider selection for RAG / FAISS.

Default: HuggingFace hosted embeddings. Ollama is an OPTION, only used when
`embedding_backend=ollama` AND `ollama_enabled=True`.
"""

from __future__ import annotations

from config import settings
from providers.base import BaseEmbeddingProvider


def get_embedder() -> BaseEmbeddingProvider:
    if settings.embedding_backend.lower() == "ollama" and settings.ollama_enabled:
        from providers.ollama_provider import OllamaEmbeddingProvider
        return OllamaEmbeddingProvider()
    from providers.huggingface_provider import HuggingFaceEmbeddingProvider
    return HuggingFaceEmbeddingProvider()
