# VakilAI — India's Legal AI Platform

A full-stack AI-powered legal platform for the Indian legal ecosystem. Dual-sided marketplace for citizens and lawyers, built entirely in Python.

## Architecture

```
vaakilai/
├── frontend/          # Streamlit web application
├── backend/           # FastAPI REST API + MongoDB
├── ai-service/        # FastAPI AI service (Claude + RAG)
├── docker-compose.yml
└── .env.example
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Python + Streamlit |
| Backend API | Python + FastAPI + Motor |
| AI Service | Python + FastAPI + Anthropic Claude |
| Database | MongoDB (Motor async driver) |
| Vector Store | Pinecone (RAG corpus) |
| File Storage | AWS S3 (ap-south-1) |
| Payments | Razorpay |
| Notifications | AWS SES + SNS + WhatsApp Business API |

---

## Quick Start

### Prerequisites

- Python 3.11+
- MongoDB 7 (local or Atlas)
- Docker & Docker Compose (recommended)

### Option 1 — Docker Compose (Recommended)

```bash
# 1. Clone and enter directory
cd /path/to/vaakilai

# 2. Copy and fill environment variables
cp .env.example .env
# Edit .env — set ANTHROPIC_API_KEY at minimum

# 3. Start all services
docker-compose up --build

# Services will be available at:
#   Frontend:   http://localhost:8501
#   Backend:    http://localhost:8000
#   AI Service: http://localhost:8001
#   MongoDB:    localhost:27017
```

### Option 2 — Local Development

#### 1. Start MongoDB

```bash
# Using Docker for MongoDB only
docker run -d --name mongodb \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=vakilai_secret \
  -p 27017:27017 mongo:7

# Or install MongoDB locally: https://www.mongodb.com/docs/manual/installation/
```

#### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example .env    # Edit with your values
uvicorn main:app --reload --port 8000
```

#### 3. AI Service

```bash
cd ai-service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env    # Same .env values
uvicorn main:app --reload --port 8001
```

#### 4. Frontend

```bash
cd frontend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
streamlit run app.py --server.port 8501
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | YES | Claude API key from console.anthropic.com |
| `MONGODB_URL` | YES | MongoDB connection string |
| `JWT_SECRET` | YES | Any random secret string (32+ chars) |
| `PINECONE_API_KEY` | No | Pinecone for vector search (RAG) |
| `AWS_ACCESS_KEY_ID` | No | S3, SES, SNS |
| `AWS_SECRET_ACCESS_KEY` | No | AWS secret |
| `RAZORPAY_KEY_ID` | No | Razorpay for payments |
| `RAZORPAY_KEY_SECRET` | No | Razorpay secret |
| `TWILIO_ACCOUNT_SID` | No | Twilio for video/SMS |

> The app runs in demo mode when optional keys are not provided — AI queries work, payments and notifications show mock responses.

---

## API Documentation

Once running, visit:
- **Backend API Docs:** http://localhost:8000/docs
- **AI Service Docs:** http://localhost:8001/docs

### Key Backend Endpoints

```
POST /api/v1/auth/register        Register consumer or lawyer
POST /api/v1/auth/login           Get JWT token

GET  /api/v1/marketplace/search   Search lawyers
POST /api/v1/marketplace/match    AI lawyer matching
POST /api/v1/consultations/       Book consultation
POST /api/v1/payments/checkout    Create Razorpay order

POST /api/v1/cases/               Create case (lawyer only)
GET  /api/v1/cases/               List cases
POST /api/v1/clients/             Create client
GET  /api/v1/analytics/growth     Practice growth KPIs
```

### Key AI Service Endpoints

```
POST /ai/consult                  AI legal consultation (SSE streaming)
GET  /ai/rights/{topic}           Know your rights explainer
POST /ai/documents/generate       Generate legal document
POST /ai/documents/review         AI document review
POST /ai/research/search          Semantic case law search
POST /ai/research/precedents      Find relevant precedents
POST /ai/research/memo            Generate research memo
POST /ai/match/score              AI lawyer matching score
POST /ai/case/complexity          Case complexity assessment
POST /ai/analytics/predict-outcome Outcome prediction
```

---

## Project Structure

### Frontend (`/frontend`)

| File | Description |
|------|-------------|
| `app.py` | Home page, login/register |
| `pages/1_AI_Chat.py` | AI Legal Chatbot (Module A) |
| `pages/2_Documents.py` | Document generation & review |
| `pages/3_Rights.py` | Know Your Rights hub |
| `pages/4_Lawyers.py` | Lawyer search & booking (Module B) |
| `pages/5_Pro_Dashboard.py` | Lawyer Pro dashboard |
| `pages/6_Cases.py` | Case management |
| `pages/7_Research.py` | Legal research tools |
| `pages/8_Billing.py` | Billing, CRM & analytics |
| `utils/api_client.py` | HTTP client for backend/AI |

### Backend (`/backend`)

| File | Description |
|------|-------------|
| `main.py` | FastAPI app, router mounting |
| `config.py` | Settings (pydantic-settings) |
| `database.py` | Motor MongoDB connection + indexes |
| `middleware/auth_middleware.py` | JWT auth, role guards |
| `models/` | Pydantic models for all entities |
| `routes/auth.py` | Register, login, refresh |
| `routes/marketplace.py` | Lawyer onboarding, search, matching |
| `routes/consultations.py` | Booking, chat (WebSocket), review |
| `routes/payments.py` | Razorpay, escrow, invoices, time entries |
| `routes/cases.py` | Case CRUD, hearings, tasks, timeline |
| `routes/clients.py` | Client CRM, portal |
| `routes/documents.py` | Upload, S3, OCR trigger |
| `routes/analytics.py` | Litigation analytics, growth, prediction |
| `services/notification_service.py` | SMS, email, WhatsApp |
| `services/payment_service.py` | Razorpay orders, invoice PDF |
| `services/storage_service.py` | S3 upload/download |

### AI Service (`/ai-service`)

| File | Description |
|------|-------------|
| `main.py` | FastAPI AI app |
| `config.py` | AI settings, model config |
| `core/llm.py` | Claude API client, system prompts |
| `core/rag.py` | Pinecone vector search, RAG pipeline |
| `core/guardrails.py` | Disclaimer enforcement, citation extraction, translation |
| `routers/consult.py` | Consultation engine, rights explainer, guides |
| `routers/documents.py` | Document generation, review, OCR |
| `routers/research.py` | Semantic search, precedents, memo, clause library |
| `routers/match.py` | Lawyer matching, complexity scoring |
| `routers/analytics.py` | Outcome prediction, judge insights |

---

## MongoDB Collections

| Collection | Description |
|-----------|-------------|
| `users` | All users (consumers, lawyers, admins) |
| `lawyer_profiles` | Lawyer details, verification, availability |
| `consultations` | Bookings, chat messages, reviews |
| `cases` | Case files, hearings, tasks, timeline |
| `clients` | Lawyer's client CRM records |
| `payments` | Razorpay orders, escrow, invoices |
| `invoices` | GST-compliant invoices |
| `time_entries` | Billable hours per case |
| `expenses` | Case expenses |
| `documents` | File metadata (actual files in S3) |
| `notifications` | Notification inbox |
| `communication_logs` | WhatsApp/SMS/email send logs |

---

## User Roles

| Role | Access |
|------|--------|
| `consumer` | AI chat, documents, rights, book lawyers |
| `lawyer` | All consumer features + Pro suite |
| `firm_admin` | All lawyer features + team management |
| `client_portal` | Own case status only (read-only) |
| `admin` | Full platform access |

## Subscription Plans

| Plan | Price | Features |
|------|-------|---------|
| Free | ₹0 | 5 AI queries/month |
| Basic | ₹499/mo | Unlimited AI + 1 lawyer call |
| Business | ₹2,999/mo | Unlimited AI + 5 lawyer hours + contract review |
| Pro (Lawyer) | ₹1,499/mo | Full Pro suite |
| Firm | ₹6,999/mo | Team plan (5-50 lawyers) |

---

## Development Notes

- Pinecone is optional — the app falls back to static context when unavailable
- AWS services (S3, SES, SNS) are optional — files save locally in dev mode
- Razorpay uses mock orders when keys are not set
- All AI responses include mandatory legal disclaimers (guardrail enforced)
- High-stakes topics (criminal, bail, adoption) always trigger human lawyer redirect

## Compliance

- DPDP Act 2023 — all data stored in MongoDB (configure Atlas in ap-south-1 for production)
- Advocates Act 1961 — AI responses labeled as "guidance", never "legal advice"
- GST — 18% applied to all consultations; GST-compliant PDF invoices generated
- RBI Escrow — Razorpay PA integration with escrow hold/release flow
