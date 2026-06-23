# VakilAI — Developer Guide

**Stack:** Next.js 14 · FastAPI · LangGraph · MongoDB · FAISS
**Root:** `/Users/saurabh/Documents/personal/vaakilai/`

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Service Ports & URLs](#service-ports--urls)
3. [Environment Variables](#environment-variables)
   - [Frontend](#frontend-env-frontend-env-local)
   - [Backend](#backend-env-backend-env)
   - [AI Service](#ai-service-env-ai_service-env)
4. [Feature Flags & What They Enable](#feature-flags--what-they-enable)
5. [Starting Each Service](#starting-each-service)
6. [Architecture Overview](#architecture-overview)
7. [Role-Based Access Control](#role-based-access-control)
8. [AI Providers](#ai-providers)
9. [FAISS / RAG Case Index](#faiss--rag-case-index)
10. [Aalap (OpenNyAI) Integration](#aalap-opennyai-integration)
11. [NyayaAnumana Dataset Ingestion](#nyayaanumana-dataset-ingestion)
12. [Database Collections](#database-collections)
13. [API Reference Summary](#api-reference-summary)
14. [Common Issues & Fixes](#common-issues--fixes)

---

## Quick Start

```bash
# 1. Frontend (Next.js 14 — requires Node 20)
cd frontend
cp .env.local.example .env.local    # fill in values
nvm use 20
npm install
npm run dev                          # http://localhost:3000

# 2. Backend (FastAPI)
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                 # fill in values
uvicorn main:app --reload --port 8000

# 3. AI Service (LangGraph + FastAPI)
cd ai_service
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                 # fill in values
uvicorn main:app --reload --port 8001
```

---

## Service Ports & URLs

| Service     | Port | URL                           | Description                    |
|-------------|------|-------------------------------|--------------------------------|
| Frontend    | 3000 | http://localhost:3000         | Next.js app                    |
| Backend API | 8000 | http://localhost:8000/api/v1  | FastAPI (auth, cases, billing) |
| AI Service  | 8001 | http://localhost:8001/ai      | LangGraph AI endpoints         |
| MongoDB     | 27017 | mongodb://localhost:27017    | Primary database               |

---

## Environment Variables

### Frontend env (`frontend/.env.local`)

| Variable                  | Required | Default                        | Description                              |
|---------------------------|----------|--------------------------------|------------------------------------------|
| `NEXT_PUBLIC_BACKEND_URL` | ✅ Yes    | `http://localhost:8000/api/v1` | FastAPI backend base URL                 |
| `NEXT_PUBLIC_AI_URL`      | ✅ Yes    | `http://localhost:8001/ai`     | AI service base URL                      |

**Example:**
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_AI_URL=http://localhost:8001/ai
```

---

### Backend env (`backend/.env`)

| Variable              | Required | Default           | Description                                  |
|-----------------------|----------|-------------------|----------------------------------------------|
| `MONGODB_URL`         | ✅ Yes    | `mongodb://localhost:27017` | MongoDB connection string         |
| `DATABASE_NAME`       | ✅ Yes    | `vakilai`         | MongoDB database name                        |
| `JWT_SECRET`          | ✅ Yes    | —                 | Secret key for JWT tokens (min 32 chars)     |
| `JWT_ALGORITHM`       | No       | `HS256`           | JWT signing algorithm                        |
| `JWT_EXPIRE_MINUTES`  | No       | `10080` (7 days)  | Token expiry in minutes                      |
| `CORS_ORIGINS`        | No       | `http://localhost:3000` | Comma-separated allowed origins        |
| `DEBUG`               | No       | `false`           | Enable FastAPI debug mode + verbose logs     |
| `APP_ENV`             | No       | `development`     | `development` / `production`                 |
| `RAZORPAY_KEY_ID`     | Optional | —                 | Razorpay API key (payments feature)          |
| `RAZORPAY_KEY_SECRET` | Optional | —                 | Razorpay secret (payments feature)           |
| `AWS_ACCESS_KEY_ID`   | Optional | —                 | S3 document storage                          |
| `AWS_SECRET_ACCESS_KEY`| Optional| —                 | S3 document storage                          |
| `S3_BUCKET`           | Optional | —                 | S3 bucket name for document uploads          |
| `WHATSAPP_TOKEN`      | Optional | —                 | WhatsApp Business API token                  |
| `TWILIO_SID`          | Optional | —                 | Twilio for SMS OTP verification              |
| `TWILIO_AUTH_TOKEN`   | Optional | —                 | Twilio auth token                            |
| `AGORA_APP_ID`        | Optional | —                 | Agora.io video consultations                 |
| `AGORA_APP_CERTIFICATE`| Optional| —                 | Agora.io certificate                         |

---

### AI Service env (`ai_service/.env`)

| Variable                    | Required | Default        | Description                                                    |
|-----------------------------|----------|----------------|----------------------------------------------------------------|
| `ANTHROPIC_API_KEY`         | ✅* Yes  | —              | Claude API key. Required if `AI_PROVIDER=claude`              |
| `AI_PROVIDER`               | No       | `claude`       | `claude` / `huggingface` / `ollama`                           |
| `MODEL_NAME`                | No       | `claude-sonnet-4-6` | Model ID (see AI Providers section)                       |
| `HUGGINGFACE_API_TOKEN`     | ✅* Yes  | —              | Required if `AI_PROVIDER=huggingface`                         |
| `PINECONE_API_KEY`          | Optional | —              | Cloud vector search. If absent, falls back to FAISS (local)   |
| `PINECONE_ENV`              | Optional | —              | Pinecone environment (e.g. `gcp-starter`)                     |
| `PINECONE_INDEX`            | Optional | `vakilai-cases`| Pinecone index name                                            |
| `AALAP_ENABLED`             | No       | `false`        | `true` to route legal tasks to Aalap (OpenNyAI Mistral 7B)    |
| `AALAP_MODEL`               | No       | `opennyaiorg/Aalap-Mistral-7B-v0.1-bf16` | Aalap model ID on HuggingFace Hub  |
| `FAISS_INDEX_PATH`          | No       | `./data/vakilai_cases.faiss` | Local FAISS index file path               |
| `NYAYAANUMANA_DATASET`      | No       | `Exploration-Lab/NyayaAnumana` | HF dataset ID for ingestion            |
| `NYAYAANUMANA_BATCH_SIZE`   | No       | `500`          | Batch size for ingestion                                       |
| `NYAYAANUMANA_MAX_CASES`    | No       | `0` (all)      | Max cases to ingest (0 = unlimited)                            |
| `JWT_SECRET`                | ✅ Yes   | —              | Must match backend JWT secret                                  |
| `JWT_ALGORITHM`             | No       | `HS256`        | Must match backend                                             |
| `CORS_ORIGINS`              | No       | `http://localhost:3000` | Allowed origins                                       |
| `DEBUG`                     | No       | `false`        | Verbose logging + expose /docs and /redoc                      |
| `APP_ENV`                   | No       | `development`  | Environment tag                                                |

*: Required for the respective `AI_PROVIDER` value.

---

## Feature Flags & What They Enable

### `AI_PROVIDER` (ai_service)

| Value           | What it enables                                        | Required keys                    |
|-----------------|--------------------------------------------------------|----------------------------------|
| `claude`        | Best quality; uses Claude Sonnet for all AI tasks      | `ANTHROPIC_API_KEY`              |
| `huggingface`   | Cost-optimised; uses HuggingFace Inference API         | `HUGGINGFACE_API_TOKEN`          |
| `ollama`        | Fully local; Ollama must be running on port 11434      | None (Ollama installed locally)  |

### `AALAP_ENABLED=true` (ai_service)

Enables the OpenNyAI Aalap model (Mistral 7B fine-tuned on Indian legal tasks) for:
- `/ai/legal-tasks/argument-builder` — Generate petitioner/respondent arguments
- `/ai/legal-tasks/issue-spotter` — Identify legal issues
- `/ai/legal-tasks/event-timeline` — Extract chronological timeline
- `/ai/legal-tasks/statute-breakdown` — Break statute into ingredients

Without this flag, all 4 endpoints fall back to the configured `AI_PROVIDER`.

**Prerequisite:** `HUGGINGFACE_API_TOKEN` must be set (Aalap is served via HF Inference API).

### `PINECONE_API_KEY` (ai_service)

Enables cloud vector search via Pinecone. If absent, FAISS local index is used automatically.
Pinecone is recommended for production deployments with large case volumes.

### `DEBUG=true`

- Backend: enables FastAPI debug mode + verbose request logging
- AI Service: exposes `/docs` (Swagger UI) and `/redoc`
- Frontend: no effect (use Next.js dev mode)

---

## Starting Each Service

### Prerequisites

```bash
# Node
nvm install 20
nvm use 20

# Python
python3 -m pip install uv   # fast installer (optional)

# MongoDB
brew install mongodb-community
brew services start mongodb-community

# (Optional) Ollama for local LLM
brew install ollama
ollama pull llama3
```

### All services at once (tmux or separate terminals)

```bash
# Terminal 1 — Frontend
cd frontend && nvm use 20 && npm run dev

# Terminal 2 — Backend
cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000

# Terminal 3 — AI Service
cd ai_service && source venv/bin/activate && uvicorn main:app --reload --port 8001
```

### Production build check

```bash
cd frontend && nvm use 20 && npm run build
```

---

## Architecture Overview

```
Browser (Next.js 14)
    │
    ├── /api/v1/* → FastAPI (backend:8000)
    │     ├── auth, users, marketplace, consultations
    │     ├── cases, clients, documents, analytics
    │     ├── payments (Razorpay), notifications (WebSocket)
    │     ├── ecourts, whatsapp, compliance, odr
    │     ├── ipc_bns, news (RSS), annotations
    │     ├── contracts_clm, ip_portfolio, citations
    │     └── client_portal, verification, video
    │
    └── /ai/* → FastAPI (ai_service:8001)
          ├── /ai/consult (SSE streaming)
          ├── /ai/documents (generate, review)
          ├── /ai/research (search, precedents, memo)
          ├── /ai/match (lawyer matching)
          ├── /ai/cases (RAG search)
          ├── /ai/predict (outcome prediction)
          ├── /ai/legal-tasks (Aalap: arguments, issues, timeline, statute)
          ├── /ai/judge-analytics (judge/court tendency)
          ├── /ai/safety (pre-filing risk check)
          ├── /ai/risk (case risk score)
          └── /ai/docs (document comparison)
```

### AI Service Internal Flow

```
Request → auth_middleware (JWT verify)
       → route handler
       → LangGraph agent (or direct LLM call)
           ├── Claude (Anthropic) — if AI_PROVIDER=claude
           ├── HuggingFace API  — if AI_PROVIDER=huggingface
           ├── Aalap (HF)       — if AALAP_ENABLED=true for legal-tasks
           └── Ollama (local)   — if AI_PROVIDER=ollama
       → FAISS / Pinecone (for RAG endpoints)
       → Response
```

---

## Role-Based Access Control

### User Roles

| Role         | Dashboard     | Nav Set       | Access          |
|--------------|---------------|---------------|-----------------|
| `consumer`   | `/dashboard`  | CONSUMER_NAV  | Public features |
| `lawyer`     | `/pro/dashboard` | PRO_NAV    | All pro features |
| `firm_admin` | `/pro/dashboard` | PRO_NAV    | All pro + team  |
| `admin`      | `/pro/dashboard` | PRO_NAV    | Everything      |
| `client`     | `/client`     | CLIENT_NAV    | Their cases only |

### Frontend Route Guards

`AppLayout` accepts two props:
- `requirePro` — redirects non-pro users to `/dashboard`
- `requireConsumer` — redirects pro users to `/pro/dashboard`

All `/pro/*` pages use `requirePro`. Consumer-only pages (Find a Lawyer, Know Your Rights) are not marked `requireConsumer` since pro users also need to find lawyers on behalf of clients.

### Checking roles in code

```typescript
// frontend/src/lib/utils.ts
isProRole(role)     // true for lawyer, firm_admin, admin
isClientRole(role)  // true for client
```

```python
# backend/middleware/auth_middleware.py
get_current_user    # any authenticated user
require_lawyer      # lawyer / firm_admin / admin only
```

---

## AI Providers

### Claude (Anthropic) — Default & Recommended

```env
AI_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-...
MODEL_NAME=claude-sonnet-4-6
```

Models available: `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`

### HuggingFace Inference API — Cost-Optimised

```env
AI_PROVIDER=huggingface
HUGGINGFACE_API_TOKEN=hf_...
MODEL_NAME=mistralai/Mistral-7B-Instruct-v0.3
```

Free tier has rate limits. Use a paid HF Inference Endpoint for production.

### Ollama — Fully Local (No API costs)

```env
AI_PROVIDER=ollama
MODEL_NAME=llama3
```

Ollama must be running: `ollama serve`. Install models with `ollama pull llama3`.

---

## FAISS / RAG Case Index

The AI service uses a local FAISS index for semantic case search, outcome prediction, and judge analytics.

### Index location
```
ai_service/data/vakilai_cases.faiss    # vector index
ai_service/data/vakilai_cases.pkl      # metadata pickle
```

### Building the index manually (small dataset)

```python
# In ai_service/
from rag.vector_store import case_store

case_store.add_cases([
    {
        "case_id": "SC2024-001",
        "case_name": "Example v. State",
        "court": "Supreme Court",
        "year": 2024,
        "practice_area": "Criminal Law",
        "facts": "...",
        "decision": "Allowed",
        "summary": "...",
    }
])
```

### Index size vs. query quality

| Cases indexed | Search quality      | Prediction quality |
|---------------|---------------------|--------------------|
| 0             | No results          | No results         |
| 1,000         | Basic               | Low confidence     |
| 10,000        | Good                | Medium             |
| 100,000+      | Excellent           | High               |
| 702,000+      | Near-production     | ~90% F1            |

---

## Aalap (OpenNyAI) Integration

Aalap is Mistral 7B fine-tuned on 22,000 Indian legal instructions (Apache-2.0 licence).

### Enable Aalap

```env
# ai_service/.env
AALAP_ENABLED=true
HUGGINGFACE_API_TOKEN=hf_...
AALAP_MODEL=opennyaiorg/Aalap-Mistral-7B-v0.1-bf16
```

### What Aalap does better than general LLMs

- Argument construction in Indian legal style
- Issue spotting from raw case facts
- Statute element analysis under Indian law
- Timeline extraction from FIR / pleadings

### Fallback behaviour

When `AALAP_ENABLED=false` (default), all four legal-task endpoints fall back to the configured `AI_PROVIDER` (Claude/HF/Ollama). The UI and API contract are identical — only the backend model changes.

---

## NyayaAnumana Dataset Ingestion

702,945 Indian court cases from IIT Kanpur (COLING 2025). Enables judge analytics, outcome prediction, and RAG case search.

### Run the ingester

```bash
cd ai_service

# Ingest first 10,000 cases (quick test)
python -m rag.nyayaanumana_ingester --max-cases 10000

# Ingest all (runs overnight, ~2-4 hours)
python -m rag.nyayaanumana_ingester

# Resume after interruption
python -m rag.nyayaanumana_ingester --resume

# Custom batch size (default 500)
python -m rag.nyayaanumana_ingester --batch-size 200
```

### Checkpoint file

Progress is saved to `ai_service/data/nyayaanumana_checkpoint.json`. Delete to restart from scratch.

### Disk space

| Cases       | Approx. FAISS index size |
|-------------|--------------------------|
| 10,000      | ~50 MB                   |
| 100,000     | ~500 MB                  |
| 702,000     | ~3.5 GB                  |

---

## Database Collections (MongoDB)

| Collection        | Used by           | Contents                                      |
|-------------------|-------------------|-----------------------------------------------|
| `users`           | auth, users       | User accounts, roles, subscription            |
| `cases`           | cases             | Lawyer's internal case files                  |
| `clients`         | clients           | Client records linked to lawyers              |
| `tracked_cases`   | ecourts           | eCourts cases tracked by users                |
| `documents`       | documents         | Uploaded/generated documents metadata         |
| `consultations`   | consultations     | Booked consultations                          |
| `payments`        | payments          | Razorpay payment records                      |
| `notifications`   | notifications     | In-app notification log                       |
| `odr_cases`       | odr               | ODR / Lok Adalat applications                 |
| `annotations`     | annotations       | Lawyer notes on cases (G9)                    |
| `contracts`       | contracts_clm     | Contract lifecycle records (G8)               |
| `ip_assets`       | ip_portfolio      | IP portfolio items (G11)                      |
| `citations`       | citations         | Case citation relationships (G13)             |

### Indexes to create for production

```javascript
// users — unique email
db.users.createIndex({ email: 1 }, { unique: true })
// users — sparse unique phone
db.users.createIndex({ phone: 1 }, { unique: true, sparse: true })
// cases — fast list by lawyer
db.cases.createIndex({ lawyer_id: 1, status: 1 })
// tracked_cases — fast list by user
db.tracked_cases.createIndex({ user_id: 1 })
// contracts — expiry alert queries
db.contracts.createIndex({ lawyer_id: 1, status: 1, end_date: 1 })
// ip_assets — renewal queries
db.ip_assets.createIndex({ lawyer_id: 1, renewal_due_date: 1 })
// annotations — case lookup
db.annotations.createIndex({ lawyer_id: 1, case_ref: 1 })
// citations — graph queries
db.citations.createIndex({ added_by: 1, cited_case_name: "text", citing_case_name: "text" })
```

---

## API Reference Summary

### Backend (`/api/v1/`)

| Prefix              | File                    | Key Endpoints                                |
|---------------------|-------------------------|----------------------------------------------|
| `/auth`             | routes/auth.py          | POST /login, /register, /refresh             |
| `/users`            | routes/users.py         | GET/PUT /{id}                                |
| `/cases`            | routes/cases.py         | CRUD + hearings, tasks, timeline             |
| `/clients`          | routes/clients.py       | CRUD client records                          |
| `/ecourts`          | routes/ecourts.py       | /track, /my, /cause-list, /cause-list/courts |
| `/ipc-bns`          | routes/ipc_bns.py       | /search?q=, /{ipc}, /reverse/{bns}, /all     |
| `/news`             | routes/news.py          | GET /, /trending, /categories                |
| `/annotations`      | routes/annotations.py   | CRUD + /reply, /tags/all                     |
| `/contracts`        | routes/contracts_clm.py | CRUD + /expiring, /clauses, /milestones      |
| `/ip`               | routes/ip_portfolio.py  | CRUD + /renewals, /actions, /stats/summary   |
| `/citations`        | routes/citations.py     | CRUD + POST /search, /stats/treatments       |
| `/marketplace`      | routes/marketplace.py   | Lawyer search, profiles                      |
| `/payments`         | routes/payments.py      | Razorpay checkout, webhook                   |
| `/compliance`       | routes/compliance.py    | Compliance checklists                        |
| `/odr`              | routes/odr.py           | ODR case filing                              |
| `/client`           | routes/client_portal.py | Client-facing case/document/message views    |

### AI Service (`/ai/`)

| Prefix              | File                          | Key Endpoints                                    |
|---------------------|-------------------------------|--------------------------------------------------|
| `/consult`          | routes/consult.py             | GET /stream (SSE), POST /                        |
| `/documents`        | routes/documents.py           | POST /generate, /review                          |
| `/research`         | routes/research.py            | POST /search, /precedents, /memo                 |
| `/match`            | routes/match.py               | POST /score, /complexity                         |
| `/cases`            | routes/cases_rag.py           | POST /search (RAG)                               |
| `/predict`          | routes/predict.py             | POST / (outcome prediction)                      |
| `/legal-tasks`      | routes/legal_tasks.py         | POST /argument-builder, /issue-spotter, /event-timeline, /statute-breakdown |
| `/judge-analytics`  | routes/judge_analytics.py     | POST /judge, /court; GET /status                 |
| `/safety`           | routes/litigation_safety.py   | POST /check; GET /status                         |
| `/risk`             | routes/risk_score.py          | POST /score; GET /status                         |
| `/docs`             | routes/doc_compare.py         | POST /compare; GET /status                       |

---

## Common Issues & Fixes

### `Node version incompatible`
Next.js 14 requires Node 18+. We pin to Node 20:
```bash
nvm use 20
# Or set default: nvm alias default 20
```

### `next/typescript ESLint preset not found`
Only exists in Next.js 15+. Our `.eslintrc.json` correctly uses `["next/core-web-vitals"]` only.

### `MongoDB DuplicateKeyError on phone field`
User created without phone but unique index exists. Fixed with:
```python
# backend/routes/users.py
user_dict = user.model_dump(exclude_none=True)
```
And the phone index is `sparse: true`.

### `FAISS index empty — no search results`
Run the ingester: `python -m rag.nyayaanumana_ingester --max-cases 5000`

### `Aalap returns empty response`
Check `HUGGINGFACE_API_TOKEN` is set and the model is not rate-limited. The Aalap model is `opennyaiorg/Aalap-Mistral-7B-v0.1-bf16` on HuggingFace.

### `AI_PROVIDER=ollama — connection refused`
Start Ollama: `ollama serve` and ensure the model is installed: `ollama pull llama3`

### Backend 404 on new routes
Ensure the new router is imported and registered in `backend/main.py`:
```python
from routes import ipc_bns  # import
app.include_router(ipc_bns.router, prefix="/api/v1/ipc-bns", tags=["IPC-BNS"])  # register
```

### SSE streaming not working
The `/ai/consult/stream` endpoint uses `GET` with query params, not `POST`. The browser `EventSource` API only supports `GET`.

### `requirePro` redirect loop
Ensure `JWT_SECRET` matches between backend and ai_service. A mismatched secret causes 401s and the auth context thinks the user is unauthenticated.
