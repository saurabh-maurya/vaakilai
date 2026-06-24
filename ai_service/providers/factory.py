import logging
import httpx
from config import settings
from .base import BaseLLMProvider, BaseEmbeddingProvider

logger = logging.getLogger(__name__)


def _is_ollama_up() -> bool:
    """Check if Ollama server is reachable (synchronous, used at startup)."""
    try:
        resp = httpx.get(f"{settings.ollama_base_url}/api/tags", timeout=3)
        return resp.status_code == 200
    except Exception:
        return False


def get_llm_provider() -> BaseLLMProvider:
    provider = settings.ai_provider.lower()
    if provider == "ollama":
        if _is_ollama_up():
            from .ollama_provider import OllamaLLMProvider
            return OllamaLLMProvider()
        logger.warning("Ollama is not reachable — falling back to HuggingFace LLM provider")
        from .huggingface_provider import HuggingFaceLLMProvider
        return HuggingFaceLLMProvider()
    elif provider == "huggingface":
        from .huggingface_provider import HuggingFaceLLMProvider
        return HuggingFaceLLMProvider()
    else:  # default: claude
        from .claude_provider import ClaudeLLMProvider
        return ClaudeLLMProvider()


def get_embedding_provider() -> BaseEmbeddingProvider:
    provider = settings.ai_provider.lower()
    if provider == "ollama":
        if _is_ollama_up():
            from .ollama_provider import OllamaEmbeddingProvider
            return OllamaEmbeddingProvider()
        logger.warning("Ollama is not reachable — falling back to HuggingFace embedding provider")
        from .huggingface_provider import HuggingFaceEmbeddingProvider
        return HuggingFaceEmbeddingProvider()
    else:  # huggingface or claude (claude has no embedding API, fall back to HF)
        from .huggingface_provider import HuggingFaceEmbeddingProvider
        return HuggingFaceEmbeddingProvider()
