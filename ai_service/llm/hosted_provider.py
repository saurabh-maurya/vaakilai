"""
Hosted LLM provider — OpenAI-compatible /chat/completions client.

Vendor-agnostic: works with any hosted inference service that speaks the
OpenAI chat API. Switch vendors by changing base_url + api_key + model in
settings (see config.py → hosted_llm_*). Examples:

    HuggingFace router : https://router.huggingface.co/v1
    Groq               : https://api.groq.com/openai/v1
    Together           : https://api.together.xyz/v1
    Fireworks          : https://api.fireworks.ai/inference/v1
    OpenRouter         : https://openrouter.ai/api/v1

This never calls Claude/Anthropic. Uses raw httpx so no extra dependency.
"""

from __future__ import annotations

import json
from typing import AsyncIterator

import httpx

from config import settings
from providers.base import BaseLLMProvider


class HostedConfigError(RuntimeError):
    """Raised when the hosted LLM is selected but not configured (no API key)."""


class HostedLLMProvider(BaseLLMProvider):
    """OpenAI-compatible hosted chat model."""

    def __init__(self):
        self.base_url = settings.hosted_llm_base_url.rstrip("/")
        self.api_key = settings.hosted_llm_api_key
        self.model = settings.hosted_llm_model
        if not self.api_key:
            raise HostedConfigError(
                "Hosted LLM selected (LLM_BACKEND=hosted) but HOSTED_LLM_API_KEY is not set. "
                f"Add a key for {self.base_url} in ai_service/.env, or set LLM_BACKEND=local "
                "to use Ollama."
            )

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def complete(
        self, messages: list[dict], max_tokens: int = 2048, temperature: float = 0.2
    ) -> str:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{self.base_url}/chat/completions",
                headers=self._headers(),
                json={
                    "model": self.model,
                    "messages": messages,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "stream": False,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()

    async def stream(
        self, messages: list[dict], max_tokens: int = 2048
    ) -> AsyncIterator[str]:
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                headers=self._headers(),
                json={
                    "model": self.model,
                    "messages": messages,
                    "max_tokens": max_tokens,
                    "stream": True,
                },
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    payload = line[len("data:"):].strip()
                    if payload == "[DONE]":
                        break
                    try:
                        delta = json.loads(payload)["choices"][0]["delta"]
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue
                    token = delta.get("content", "")
                    if token:
                        yield token
