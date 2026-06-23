from typing import AsyncIterator, List
import httpx
from .base import BaseLLMProvider, BaseEmbeddingProvider
from config import settings


class OllamaLLMProvider(BaseLLMProvider):
    """Uses Ollama local API — default model: phi3:mini or llama3.2:1b."""

    def __init__(self):
        self.base_url = settings.ollama_base_url
        self.model = settings.ollama_llm_model

    def _format_messages(self, messages: list[dict]) -> str:
        parts = []
        for m in messages:
            role = m["role"].capitalize()
            parts.append(f"{role}: {m['content']}")
        parts.append("Assistant:")
        return "\n\n".join(parts)

    async def complete(self, messages: list[dict], max_tokens: int = 2048, temperature: float = 0.2) -> str:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "messages": messages,
                    "stream": False,
                    "options": {"temperature": temperature, "num_predict": max_tokens},
                },
            )
            resp.raise_for_status()
            return resp.json()["message"]["content"]

    async def stream(self, messages: list[dict], max_tokens: int = 2048) -> AsyncIterator[str]:
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "messages": messages,
                    "stream": True,
                    "options": {"num_predict": max_tokens},
                },
            ) as resp:
                async for line in resp.aiter_lines():
                    if line:
                        import json
                        data = json.loads(line)
                        token = data.get("message", {}).get("content", "")
                        if token:
                            yield token


class OllamaEmbeddingProvider(BaseEmbeddingProvider):
    """Uses Ollama embeddings — default model: nomic-embed-text."""

    def __init__(self):
        self.base_url = settings.ollama_base_url
        self.model = settings.ollama_embedding_model
        self._dim = 768  # nomic-embed-text dimension

    def dimension(self) -> int:
        return self._dim

    async def embed(self, texts: List[str]) -> List[List[float]]:
        embeddings = []
        async with httpx.AsyncClient(timeout=60) as client:
            for text in texts:
                resp = await client.post(
                    f"{self.base_url}/api/embeddings",
                    json={"model": self.model, "prompt": text},
                )
                resp.raise_for_status()
                embeddings.append(resp.json()["embedding"])
        return embeddings
