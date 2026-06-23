from typing import AsyncIterator, List
import anthropic
from .base import BaseLLMProvider, BaseEmbeddingProvider
from config import settings


class ClaudeLLMProvider(BaseLLMProvider):
    def __init__(self):
        self.client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.model = settings.model_name

    async def complete(self, messages: list[dict], max_tokens: int = 2048, temperature: float = 0.2) -> str:
        system = next((m["content"] for m in messages if m["role"] == "system"), "")
        user_msgs = [m for m in messages if m["role"] != "system"]
        resp = await self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system,
            messages=user_msgs,
        )
        return resp.content[0].text

    async def stream(self, messages: list[dict], max_tokens: int = 2048) -> AsyncIterator[str]:
        system = next((m["content"] for m in messages if m["role"] == "system"), "")
        user_msgs = [m for m in messages if m["role"] != "system"]
        async with self.client.messages.stream(
            model=self.model,
            max_tokens=max_tokens,
            system=system,
            messages=user_msgs,
        ) as stream:
            async for text in stream.text_stream:
                yield text
