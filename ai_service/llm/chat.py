"""
Chat providers for the pluggable generation layer.

Every provider implements BaseLLMProvider (`complete` / `stream`) so they can be
mixed freely inside the priority ChainLLMProvider:

    Claude   — Anthropic SDK
    Groq     — OpenAI-compatible (also HuggingFace router / Together / Gemini)
    Gemini   — OpenAI-compatible endpoint
    hosted   — generic OpenAI-compatible (HuggingFace router by default)
    ollama   — local Ollama (optional, gated by settings.ollama_enabled)
    Aalap    — OpenNyAI Indian-legal model via HF Inference API or Ollama
"""

from __future__ import annotations

import json
from typing import AsyncIterator

import httpx

from config import settings
from providers.base import BaseLLMProvider


def messages_to_prompt(messages: list[dict]) -> str:
    """Flatten chat messages into a single instruction prompt (for text-gen models)."""
    system = " ".join(m["content"] for m in messages if m.get("role") == "system")
    body = "\n\n".join(m.get("content", "") for m in messages if m.get("role") != "system")
    return f"{system}\n\n{body}".strip() if system else body


class OpenAICompatProvider(BaseLLMProvider):
    """Any vendor speaking the OpenAI /chat/completions API."""

    def __init__(self, base_url: str, api_key: str, model: str, name: str = "hosted"):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.name = name

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}

    async def complete(self, messages: list[dict], max_tokens: int = 2048, temperature: float = 0.2) -> str:
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
            return resp.json()["choices"][0]["message"]["content"].strip()

    async def stream(self, messages: list[dict], max_tokens: int = 2048) -> AsyncIterator[str]:
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                headers=self._headers(),
                json={"model": self.model, "messages": messages, "max_tokens": max_tokens, "stream": True},
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


class ClaudeChatProvider(BaseLLMProvider):
    """Anthropic Claude (native SDK)."""

    name = "claude"

    def __init__(self):
        import anthropic
        self.client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.model = settings.claude_model or settings.model_name

    async def complete(self, messages: list[dict], max_tokens: int = 2048, temperature: float = 0.2) -> str:
        system = " ".join(m["content"] for m in messages if m["role"] == "system")
        user_msgs = [{"role": m["role"], "content": m["content"]} for m in messages if m["role"] != "system"]
        resp = await self.client.messages.create(
            model=self.model, max_tokens=max_tokens, temperature=temperature,
            system=system, messages=user_msgs,
        )
        return resp.content[0].text

    async def stream(self, messages: list[dict], max_tokens: int = 2048) -> AsyncIterator[str]:
        system = " ".join(m["content"] for m in messages if m["role"] == "system")
        user_msgs = [{"role": m["role"], "content": m["content"]} for m in messages if m["role"] != "system"]
        async with self.client.messages.stream(
            model=self.model, max_tokens=max_tokens, system=system, messages=user_msgs,
        ) as stream:
            async for text in stream.text_stream:
                yield text


class AalapProvider(BaseLLMProvider):
    """OpenNyAI Aalap (Indian-legal Mistral-7B) via HF Inference API or Ollama."""

    name = "aalap"

    def __init__(self, backend: str = "hosted"):
        self.backend = backend

    async def complete(self, messages: list[dict], max_tokens: int = 1024, temperature: float = 0.2) -> str:
        prompt = messages_to_prompt(messages)
        if self.backend == "ollama":
            return await self._ollama(messages, max_tokens, temperature)
        return await self._hosted(prompt, max_tokens, temperature)

    async def _hosted(self, prompt: str, max_tokens: int, temperature: float) -> str:
        instruct = f"<s>[INST] {prompt} [/INST]"
        url = f"{settings.aalap_hf_base_url.rstrip('/')}/{settings.aalap_model}"
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                url,
                headers={"Authorization": f"Bearer {settings.huggingface_api_token}"},
                json={
                    "inputs": instruct,
                    "parameters": {
                        "max_new_tokens": max_tokens, "temperature": temperature,
                        "return_full_text": False, "do_sample": True,
                    },
                    "options": {"wait_for_model": False},  # fail fast; the chain falls over
                },
            )
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, list) and data:
                return data[0].get("generated_text", "").strip()
            # HF returns {"error": "...loading..."} etc. — raise so the chain fails over
            raise RuntimeError(f"aalap unavailable: {str(data)[:120]}")

    async def _ollama(self, messages: list[dict], max_tokens: int, temperature: float) -> str:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{settings.ollama_base_url}/api/chat",
                json={
                    "model": settings.aalap_ollama_model, "messages": messages, "stream": False,
                    "options": {"temperature": temperature, "num_predict": max_tokens},
                },
            )
            resp.raise_for_status()
            return resp.json()["message"]["content"]

    async def stream(self, messages: list[dict], max_tokens: int = 1024) -> AsyncIterator[str]:
        # Aalap has no low-latency token stream on HF text-gen — emit the full answer once.
        yield await self.complete(messages, max_tokens=max_tokens)
