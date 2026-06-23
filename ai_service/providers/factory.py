from config import settings
from .base import BaseLLMProvider, BaseEmbeddingProvider


def get_llm_provider() -> BaseLLMProvider:
    provider = settings.ai_provider.lower()
    if provider == "ollama":
        from .ollama_provider import OllamaLLMProvider
        return OllamaLLMProvider()
    elif provider == "huggingface":
        from .huggingface_provider import HuggingFaceLLMProvider
        return HuggingFaceLLMProvider()
    else:  # default: claude
        from .claude_provider import ClaudeLLMProvider
        return ClaudeLLMProvider()


def get_embedding_provider() -> BaseEmbeddingProvider:
    provider = settings.ai_provider.lower()
    if provider == "ollama":
        from .ollama_provider import OllamaEmbeddingProvider
        return OllamaEmbeddingProvider()
    else:  # huggingface or claude (claude has no embedding API, fall back to HF)
        from .huggingface_provider import HuggingFaceEmbeddingProvider
        return HuggingFaceEmbeddingProvider()
