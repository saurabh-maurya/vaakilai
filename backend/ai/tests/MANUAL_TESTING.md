# VaakilAI — AI Features: Manual Test Guide

This covers **every AI feature** in the product and how to verify it by hand,
plus the automated contract tests in this folder.

AI is consumed over **two surfaces**:

1. **Frontend → ai_service directly** (`aiApi`, base `http://localhost:8001`, **no `/ai` prefix**, so every path must start with `/ai/…`). Most "Pro" tools.
2. **Backend → ai_service** (proxy, `settings.ai_service_url`, service-to-service `X-Internal-Key`). WhatsApp, ODR, document OCR, marketplace, analytics.

The actual model code lives in `ai_service/` (Claude by default; the Notice tool
uses the open-model layer `ai_service/llm/`). See `../MIGRATING_OFF_CLAUDE.md`.

---

## 0. Prerequisites

```bash
# From repo root — starts mongo/redis, ai_service (:8001), backend (:8000), frontend (:3000)
./start.sh
```

Env that matters:
- `ai_service/.env`: `ANTHROPIC_API_KEY` (or set `AI_PROVIDER=huggingface|ollama`), `INTERNAL_SERVICE_KEY`, and for the Notice tool `LLM_BACKEND` + `HOSTED_LLM_*`.
- `backend/.env`: `AI_SERVICE_URL=http://localhost:8001`, `INTERNAL_SERVICE_KEY` (**must match** ai_service).

For direct `curl` against ai_service, export the key once:
```bash
export IK="$(grep -E '^INTERNAL_SERVICE_KEY=' ai_service/.env | cut -d= -f2)"
alias aicurl='curl -s -H "X-Internal-Key: $IK" -H "Content-Type: application/json"'
```

---

## 1. Automated contract tests (run these first)

```bash
./backend/ai/tests/run_tests.sh
```

What they prove (no running services needed):
- `test_client_contract.py` — the backend AI client hits the correct ai_service path/method/body and sends the internal key. *(backend venv)*
- `test_ai_service_endpoints.py` — ai_service actually exposes every endpoint the backend needs; OCR is confirmed absent. *(ai_service venv)*
- `test_frontend_contract.py` — every `aiApi(...)` path in the frontend resolves to a real ai_service route. Auto-catches a lost `/ai` prefix. *(ai_service venv)*

`xfailed` = the two documented gaps in case-intelligence (see §4).

---

## 2. Frontend features (UI walkthrough)

Log in, then exercise each page. "Expected" = a real AI result; on failure each
page shows a fallback/mock, so **confirm the content is specific to your input**,
not the canned text.

| # | Feature | Page (URL) | ai_service endpoint | How to test |
|---|---------|-----------|---------------------|-------------|
| 1 | Legal chat (streaming) | chat widget / `useChat` | `GET /ai/consult/stream` | Ask "What is anticipatory bail?" → tokens stream in |
| 2 | Compliance Q&A | `/compliance-filings` | `POST /ai/consult` | Ask a filing question → answer + confidence |
| 3 | Case semantic search | `/cases/search` | `GET /ai/cases/search` | Search "cheque bounce acquittal" → ranked results + AI summary |
| 4 | Search within a case | `/cases/search` (open a case) | `POST /ai/cases/{id}/search` | Ask a question inside a case → answer + excerpts |
| 5 | Index from Indian Kanoon | `/cases/search` | `POST /ai/cases/index/url` | "Index" a query → "Indexed N cases" |
| 6 | Index uploaded PDF | `/cases/search` | `POST /ai/cases/index/upload` | Upload a judgment PDF → "Indexed: <title>" |
| 7 | Document compare | `/documents` | `POST /ai/docs/compare` | Paste two clauses → differences/risks |
| 8 | Document generate | `/documents` | `POST /ai/documents/generate` | Generate a draft → document text/download |
| 9 | Document review | `/documents` | `POST /ai/documents/review` | Paste a contract → issues/suggestions |
| 10 | Legal research | research page (`researchApi`) | `POST /ai/research/search`, `/precedents`, `/memo` | Search judgments; build a memo |
| 11 | **Argument builder** | `/pro/arguments` | `POST /ai/legal-tasks/argument-builder` | Enter ≥50 chars of facts → petitioner/respondent arguments |
| 12 | **Issue spotter** | `/pro/issues` | `POST /ai/legal-tasks/issue-spotter` | Enter facts → list of legal issues |
| 13 | **Event timeline** | `/pro/timeline` | `POST /ai/legal-tasks/event-timeline` | Paste facts/FIR → dated timeline |
| 14 | **Statute breakdown** | `/pro/statute` | `POST /ai/legal-tasks/statute-breakdown` | Paste a section → plain-English breakdown |
| 15 | **Judge analytics** | `/pro/judge-analytics` | `POST /ai/judge-analytics/judge` | Enter a judge name → tendencies (needs cases indexed) |
| 16 | **Notice drafting** (open-model) | `/pro/notices` | `POST /ai/notices/draft` | Fill notice form → drafted legal notice |
| 17 | Pre-filing risk / prediction | `/pro/case-intelligence` | `POST /ai/safety/check`, `/ai/predict` | ⚠️ **see §4 — currently broken** |

> Features 11–16 were **all broken before this change** (their `aiApi` calls were
> missing the `/ai` prefix, or used a wrong sub-path). They are fixed now — the
> frontend contract test guards against a regression.

### Quick `curl` equivalents (bypass the UI)

```bash
aicurl -X POST localhost:8001/ai/legal-tasks/argument-builder \
  -d '{"case_facts":"The accused issued a cheque for 4 lakh which was dishonoured for insufficient funds despite repeated demands.","practice_area":"Criminal"}'

aicurl -X POST localhost:8001/ai/judge-analytics/judge \
  -d '{"judge_name":"Justice D.Y. Chandrachud","top_k":20}'

aicurl -X POST localhost:8001/ai/notices/draft \
  -d '{"notice_type":"legal_demand","sender_name":"A","recipient_name":"B","facts":"Payment of 2 lakh is overdue by 90 days despite reminders.","demand":"Pay within 15 days","compliance_days":15}'
```

---

## 3. Backend-proxied features

These go through the backend (`:8000`), which forwards to ai_service with the
internal key.

| Feature | Trigger | Backend → ai_service | How to test |
|---------|---------|----------------------|-------------|
| WhatsApp legal Q&A | Twilio webhook `POST /api/v1/whatsapp/webhook` | `POST /ai/consult` | Send a WhatsApp msg (or POST a Twilio-shaped form) → AI reply |
| ODR prep wizard | `POST /api/v1/odr/prepare` | `POST /ai/consult` | Submit an ODR wizard → position paper/BATNA (**now sends the internal key — previously 401'd**) |
| Lawyer matching | `POST /api/v1/marketplace/match` | `POST /ai/match/score` (per candidate) | Post a legal issue → ranked verified lawyers with `ai_assisted:true` |
| Case complexity | `POST /api/v1/marketplace/complexity-score` | `POST /ai/match/complexity` | Post case facts → complexity/tier |
| Outcome prediction | `POST /api/v1/analytics/predict-outcome` (Pro) | `POST /ai/predict` | Post case facts → probability/factors |
| Judge insights | `GET /api/v1/analytics/judges/{id}` (Pro) | `POST /ai/judge-analytics/judge` | Fetch a judge → analytics |
| Document OCR | Upload a PDF/image via `POST /api/v1/documents/upload` | `POST /ai/documents/ocr` | ⚠️ **see §4 — endpoint doesn't exist yet** |

Backend health (checks the ai_service link):
```bash
curl -s localhost:8000/api/v1/admin/health   # (admin auth) → "ai_service":"ok"
```

---

## 4. Known gaps (documented, NOT yet working)

1. **Document OCR** — `backend/ai/client.ocr_document` posts to `/ai/documents/ocr`,
   but **ai_service has no OCR route** (only `/ai/documents/generate` and `/review`).
   The trigger is a graceful no-op; uploaded docs stay `ocr_status: "pending"`.
   *Fix:* implement an OCR endpoint in `ai_service/routes/documents.py`, then move
   the entry from `KNOWN_GAPS` to `WORKING` in `contract.py`.

2. **Case-intelligence (pre-filing risk + prediction)** — `/pro/case-intelligence`
   posts `/safety-check` and `/predict` with its `SharedInput`
   (`parties/background/key_events/…`). Both are wrong:
   - `/safety-check` → real path is `/ai/safety/check`, and the body must supply
     `case_facts` (≥50 chars), `proposed_relief`, `court` — the page sends none of them.
   - `/predict` → needs the `/ai` prefix and a `case_facts` field.
   Because the fields differ in **both** directions (request and response), this
   needs a small adapter, not a one-line path fix. Left untouched on purpose so a
   wrong mapping doesn't silently produce misleading litigation-risk output. The
   page currently falls back to mock data.

3. **Server-side lawyer ranking** — ai_service scores one lawyer per call. The
   backend now builds a candidate pool and scores each (`/marketplace/match`).
   A dedicated ranked-list endpoint would be a future optimisation.
