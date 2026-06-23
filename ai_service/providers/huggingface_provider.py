from typing import AsyncIterator, List
import httpx
from .base import BaseLLMProvider, BaseEmbeddingProvider
from config import settings


HF_API_BASE = "https://api-inference.huggingface.co/models"
HEADERS = lambda: {"Authorization": f"Bearer {settings.huggingface_api_token}"}


class HuggingFaceLLMProvider(BaseLLMProvider):
    """Uses HuggingFace Inference API — default model: Mistral-7B-Instruct."""

    def __init__(self):
        self.model = settings.hf_llm_model

    def _build_prompt(self, messages: list[dict]) -> str:
        parts = []
        for m in messages:
            role = m["role"]
            content = m["content"]
            if role == "system":
                parts.append(f"<s>[INST] <<SYS>>\n{content}\n<</SYS>>\n\n")
            elif role == "user":
                parts.append(f"{content} [/INST] ")
            elif role == "assistant":
                parts.append(f"{content} </s><s>[INST] ")
        return "".join(parts)

    async def complete(self, messages: list[dict], max_tokens: int = 2048, temperature: float = 0.2) -> str:
        prompt = self._build_prompt(messages)
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{HF_API_BASE}/{self.model}",
                headers=HEADERS(),
                json={
                    "inputs": prompt,
                    "parameters": {
                        "max_new_tokens": max_tokens,
                        "temperature": max(temperature, 0.01),
                        "return_full_text": False,
                    },
                },
            )
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, list):
                return data[0].get("generated_text", "")
            return data.get("generated_text", str(data))

    async def stream(self, messages: list[dict], max_tokens: int = 2048) -> AsyncIterator[str]:
        # HF free tier doesn't support true streaming — yield full response as one chunk
        result = await self.complete(messages, max_tokens=max_tokens)
        yield result


class HuggingFaceEmbeddingProvider(BaseEmbeddingProvider):
    """Uses sentence-transformers/all-MiniLM-L6-v2 via HF Inference API."""

    def __init__(self):
        self.model = settings.hf_embedding_model
        self._dim = 384  # all-MiniLM-L6-v2 dimension

    def dimension(self) -> int:
        return self._dim

    async def embed(self, texts: List[str]) -> List[List[float]]:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{HF_API_BASE}/{self.model}",
                headers=HEADERS(),
                json={"inputs": texts, "options": {"wait_for_model": True}},
            )
            resp.raise_for_status()
            return resp.json()
