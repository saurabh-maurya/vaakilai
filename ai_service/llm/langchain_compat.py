"""
Drop-in replacement for the slice of LangChain's ChatAnthropic that the agents
use (`.ainvoke(messages).content` and `.astream(messages)`), backed by the open
`llm/` layer instead of Claude.

Lets the LangChain-style agents (consultation, research, document, matching) run
on the hosted/local open model without rewriting every call site: only their
local `get_llm()` factory changes to return `get_chat_llm(...)`.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

from . import get_llm

# LangChain message `.type` -> OpenAI chat role
_ROLE = {
    "system": "system",
    "human": "user",
    "ai": "assistant",
    "user": "user",
    "assistant": "assistant",
}


def _to_messages(messages: list[Any]) -> list[dict]:
    out = []
    for m in messages:
        if isinstance(m, dict):
            role = _ROLE.get(m.get("role", "user"), "user")
            content = m.get("content", "")
        else:  # LangChain SystemMessage / HumanMessage / AIMessage
            role = _ROLE.get(getattr(m, "type", "human"), "user")
            content = getattr(m, "content", "")
        out.append({"role": role, "content": content})
    return out


class ChatLLMCompat:
    """Mimics ChatAnthropic.ainvoke / .astream over the open llm layer."""

    def __init__(self, max_tokens: int = 2048, temperature: float = 0.2, streaming: bool = False):
        self.max_tokens = max_tokens
        self.temperature = temperature
        self.streaming = streaming

    async def ainvoke(self, messages: list[Any]):
        text = await get_llm().complete(
            _to_messages(messages), max_tokens=self.max_tokens, temperature=self.temperature
        )
        return SimpleNamespace(content=text)

    async def astream(self, messages: list[Any]):
        # Groq's current models (compound / gpt-oss / qwen3) emit their answer in a
        # `reasoning` channel during token streaming, so the raw `content` stream is
        # empty/flaky. The non-streaming `complete()` reliably returns the final
        # answer, so generate once and chunk it to preserve a streaming UX.
        import re
        text = await get_llm().complete(
            _to_messages(messages), max_tokens=self.max_tokens, temperature=self.temperature
        )
        for chunk in re.findall(r"\S+\s*", text):
            yield SimpleNamespace(content=chunk)


def get_chat_llm(max_tokens: int = 2048, temperature: float = 0.2, streaming: bool = False) -> ChatLLMCompat:
    return ChatLLMCompat(max_tokens=max_tokens, temperature=temperature, streaming=streaming)
