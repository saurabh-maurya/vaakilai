# `llm/` — Swappable LLM layer (hosted ⇄ local)

Single switch-point for the model that powers VaakilAI's drafting tools
(currently the **Notice Drafting Helper**). **Claude is never used here** — you
choose between a **hosted open model** and a **local model**, by config only.

## Switch the backend (no code changes)

Set `LLM_BACKEND` in `ai_service/.env`:

| `LLM_BACKEND` | Runs on | Configure with |
|---|---|---|
| `hosted` *(default)* | Any OpenAI-compatible hosted endpoint | `HOSTED_LLM_BASE_URL`, `HOSTED_LLM_API_KEY`, `HOSTED_LLM_MODEL` |
| `local` | Ollama on your machine | `OLLAMA_BASE_URL`, `OLLAMA_LLM_MODEL` |

### Hosted vendors (pick one, set the 3 vars)

| Vendor | `HOSTED_LLM_BASE_URL` | Example model |
|---|---|---|
| HuggingFace router *(default)* | `https://router.huggingface.co/v1` | `mistralai/Mistral-7B-Instruct-v0.3` |
| Groq (fastest, cheap) | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |
| Together | `https://api.together.xyz/v1` | `mistralai/Mistral-7B-Instruct-v0.3` |
| Fireworks | `https://api.fireworks.ai/inference/v1` | `accounts/fireworks/models/mixtral-8x7b-instruct` |
| OpenRouter | `https://openrouter.ai/api/v1` | `mistralai/mistral-7b-instruct` |

Any vendor speaking the OpenAI `/chat/completions` API works with the same code.

## Use it in code

```python
from llm import get_llm, describe, LLMUnavailable

provider = get_llm()                       # hosted or local, per settings
text = await provider.complete(messages)   # BaseLLMProvider interface
```

`describe()` returns the active backend/model/endpoint and whether it's ready.
`get_llm()` raises `LLMUnavailable` if the selected backend is misconfigured
(no hosted key) or offline (Ollama down) — it does **not** silently fall back to Claude.

## Files

- `__init__.py` — `get_llm()` selector + `describe()` status.
- `hosted_provider.py` — vendor-agnostic OpenAI-compatible client (`HostedLLMProvider`).
- Local backend reuses `providers/ollama_provider.py`.
