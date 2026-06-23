from abc import ABC, abstractmethod
from typing import AsyncIterator, List


class BaseLLMProvider(ABC):
    @abstractmethod
    async def complete(self, messages: list[dict], max_tokens: int = 2048, temperature: float = 0.2) -> str:
        """Return a completion string."""

    @abstractmethod
    async def stream(self, messages: list[dict], max_tokens: int = 2048) -> AsyncIterator[str]:
        """Stream tokens."""


class BaseEmbeddingProvider(ABC):
    @abstractmethod
    async def embed(self, texts: List[str]) -> List[List[float]]:
        """Return embedding vectors for a list of texts."""

    @abstractmethod
    def dimension(self) -> int:
        """Return embedding dimension."""
