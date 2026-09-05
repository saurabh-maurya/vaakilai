"""
ChainLLMProvider — tries providers in priority order, falling over on failure.

A provider is skipped for a short cooldown after it fails (or returns empty), so
a dead provider (e.g. Claude out of credits, or Aalap not loaded) doesn't add
latency to every request. The cooldown expires automatically so recovery is
picked up without a restart.
"""

from __future__ import annotations

import logging
import time
from typing import AsyncIterator

from providers.base import BaseLLMProvider

logger = logging.getLogger(__name__)

COOLDOWN_SECONDS = 60
_cooldown: dict[str, float] = {}


class LLMUnavailable(RuntimeError):
    """Raised when no provider in the chain could serve the request."""


def _skip(name: str) -> bool:
    exp = _cooldown.get(name)
    return exp is not None and exp > time.monotonic()


def _trip(name: str) -> None:
    _cooldown[name] = time.monotonic() + COOLDOWN_SECONDS


class ChainLLMProvider(BaseLLMProvider):
    def __init__(self, entries: list[tuple[str, BaseLLMProvider]]):
        self.entries = entries  # ordered [(name, provider), ...]

    @property
    def names(self) -> list[str]:
        return [n for n, _ in self.entries]

    async def complete(self, messages: list[dict], max_tokens: int = 2048, temperature: float = 0.2) -> str:
        errors = []
        for name, provider in self.entries:
            if _skip(name):
                continue
            try:
                out = await provider.complete(messages, max_tokens=max_tokens, temperature=temperature)
                if out and out.strip():
                    return out
                _trip(name)  # empty output → treat as unavailable, try next
                logger.warning("LLM provider '%s' returned empty output; falling over", name)
            except Exception as exc:  # noqa: BLE001
                _trip(name)
                errors.append(f"{name}: {type(exc).__name__}: {str(exc)[:100]}")
                logger.warning("LLM provider '%s' failed: %s", name, exc)
        raise LLMUnavailable(
            "All LLM providers unavailable. Tried: " + (", ".join(self.names) or "none")
            + (". Errors: " + " | ".join(errors) if errors else "")
        )

    async def stream(self, messages: list[dict], max_tokens: int = 2048) -> AsyncIterator[str]:
        for name, provider in self.entries:
            if _skip(name):
                continue
            agen = provider.stream(messages, max_tokens=max_tokens)
            try:
                first = await agen.__anext__()
            except StopAsyncIteration:
                _trip(name)
                continue
            except Exception as exc:  # noqa: BLE001
                _trip(name)
                logger.warning("LLM provider '%s' stream failed: %s", name, exc)
                continue
            # committed to this provider
            yield first
            async for token in agen:
                yield token
            return
        raise LLMUnavailable("All LLM providers unavailable for streaming. Tried: " + ", ".join(self.names))
