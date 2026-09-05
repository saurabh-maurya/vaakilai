# Migrating ai_service agents off Claude → free / open models

All model code lives in **`ai_service/`**. The backend and frontend only make
HTTP calls — nothing to change there for a model swap.

There is already **one swap-point** for open models: `ai_service/llm/`
(`get_llm()` → hosted OpenAI-compatible endpoint or local Ollama, **never
Claude**). Today only the Notice tool uses it. This guide is how to move the
rest.

## The two "free/open" targets

| Target | Config | Cost | Notes |
|--------|--------|------|-------|
| **Hosted open model** (`LLM_BACKEND=hosted`) | `HOSTED_LLM_BASE_URL`, `HOSTED_LLM_API_KEY`, `HOSTED_LLM_MODEL` | Free tier, **rate-limited** | HuggingFace router (default), Groq, Together, Fireworks, OpenRouter — all OpenAI-compatible |
| **Local Ollama** (`LLM_BACKEND=local`) | `OLLAMA_BASE_URL`, `OLLAMA_LLM_MODEL` | **Fully free** | Needs a machine to run it; `ollama pull mistral` etc. |

Both implement the same interface — `await provider.complete(messages, max_tokens, temperature)` and `.stream(messages)` — so migration is mechanical.

## Per-agent / per-route inventory

Legend for **Mechanism**:
- **factory** = `providers.factory.get_llm_provider()` (already honours `AI_PROVIDER`, defaults Claude)
- **langchain** = `langchain_anthropic.ChatAnthropic` + `.ainvoke([...])`
- **direct** = inline `import anthropic` in a `_call_llm`/`_llm_analyse` helper (usually already has a HuggingFace branch)
- **open** = already on the `llm/` layer

| Feature | File | Endpoint | Mechanism | Migration effort | Recommendation |
|---------|------|----------|-----------|------------------|----------------|
| Notice drafting | `agents/notice_agent.py` | `/ai/notices/draft` | **open** ✅ | — | Done — reference implementation |
| Outcome prediction | `agents/prediction_agent.py` | `/ai/predict` | factory | **Low** (drop-in) | Migrate — JSON verdict, small output |
| Legal tasks (Aalap) | `agents/aalap_agent.py` | `/ai/legal-tasks/*` | factory | **Low** | Migrate — argument/issue/statute/timeline are drafting-shaped |
| Case RAG search | `rag/case_search.py`, `routes/cases_rag.py` | `/ai/cases/*` | factory | **Low** | Migrate — answers grounded by retrieved cases |
| RAG embeddings | `rag/vector_store.py` | (all RAG) | `get_embedding_provider()` | **None** | Already open (HF/Ollama); Claude has no embeddings anyway |
| Litigation safety | `routes/litigation_safety.py` | `/ai/safety/check` | direct | **Low–Med** | Keep on Claude or accept quality drop (limitation-period reasoning) |
| Judge analytics | `routes/judge_analytics.py` | `/ai/judge-analytics/*` | direct | **Low–Med** | Migrate cautiously — analysis quality matters |
| Case risk score | `routes/risk_score.py` | `/ai/risk/score` | direct | **Low–Med** | Keep on Claude initially |
| Document compare | `routes/doc_compare.py` | `/ai/docs/compare` | direct | **Low–Med** | Migrate — summarisation-shaped |
| Consultation Q&A | `agents/consultation_agent.py` | `/ai/consult(/stream)` | langchain | **Medium** (streaming) | Migrate last — core UX, needs streaming parity |
| Legal research | `agents/research_agent.py` | `/ai/research/*` | langchain | **Medium** | Migrate — search/memo drafting |
| Document generate/review | `agents/document_agent.py` | `/ai/documents/*` | langchain | **Medium** | Migrate — drafting-shaped |
| Lawyer matching | `agents/matching_agent.py` | `/ai/match/*` | langchain | **Medium** | Migrate — short JSON scoring |

### Suggested order
1. **Free wins now:** RAG embeddings (already open). Set `LLM_BACKEND` + keys and try the Notice tool to confirm the open path works end-to-end.
2. **Low effort, low stakes:** `prediction`, `aalap` (legal-tasks), `case_search` — flip factory → `llm/`.
3. **Localized helpers:** `doc_compare`, `judge_analytics` — one helper each.
4. **Higher stakes / more work:** `consultation` (+streaming), `research`, `document`, `matching`.
5. **Leave on Claude (or A/B):** `litigation_safety`, `risk_score` — judgment-heavy legal reasoning where a 7B model is materially weaker.

## How to migrate each pattern

### factory → llm/ (drop-in, same interface)
```python
# before
from providers.factory import get_llm_provider
provider = get_llm_provider()
text = await provider.complete(messages)

# after
from llm import get_llm            # hosted or local per LLM_BACKEND, never Claude
provider = get_llm()
text = await provider.complete(messages)
```

### direct anthropic helper → llm/
```python
# routes/litigation_safety.py, judge_analytics.py, risk_score.py, doc_compare.py
from llm import get_llm

async def _call_llm(prompt: str) -> str:
    try:
        return await get_llm().complete([{"role": "user", "content": prompt}], max_tokens=1500)
    except Exception as e:
        logger.warning(f"LLM call failed: {e}")
        return "{}"
```
Delete the inline `import anthropic` / `settings.ai_provider` branches.

### langchain ChatAnthropic → llm/
```python
# before
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import SystemMessage, HumanMessage
resp = await get_llm().ainvoke([SystemMessage(content=sys), HumanMessage(content=user)])
out = resp.content

# after
from llm import get_llm
out = await get_llm().complete(
    [{"role": "system", "content": sys}, {"role": "user", "content": user}]
)
```
For streaming (`consultation_agent`), use `async for tok in get_llm().stream(messages): ...`.

## Important caveats
- **Quality:** a 7B open model is fine for drafting/summarising/extraction, but
  weaker than Claude on multi-step legal judgment (prediction, risk, limitation
  periods). Migrate low-stakes features first; A/B the rest.
- **No silent Claude fallback:** `get_llm()` raises `LLMUnavailable` if the
  selected backend is misconfigured/offline — by design. Handle it per route.
- **`AI_PROVIDER` vs `LLM_BACKEND`:** the *factory* path is gated by legacy
  `AI_PROVIDER` (claude|huggingface|ollama) and its `huggingface_provider` uses
  the old HF Inference API. Prefer moving agents onto `llm/` (OpenAI-compatible,
  vendor-agnostic) rather than leaning on `AI_PROVIDER=huggingface`.
- After migrating an agent, add its endpoint to the assertions in
  `backend/ai/tests/` if not already covered.
