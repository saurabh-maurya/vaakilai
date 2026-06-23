# VakilAI — Usage Guide

India's AI-powered legal platform. Three layers: **AI Assistant** (citizens & SMEs) · **Connect** (lawyer marketplace) · **Pro** (lawyer suite).

---

## Quick Start

### Prerequisites
- Node.js 20+
- Python 3.12+
- MongoDB (local or Atlas)
- Anthropic API key

### 1. Clone & configure environment

```bash
# Copy the example env file
cp .env.example .env
```

Edit `.env` and fill in:

```env
# Required
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxx
JWT_SECRET=your-secret-key-here
MONGODB_URL=mongodb://localhost:27017

# Optional (for vector search over 4M+ judgments)
PINECONE_API_KEY=
PINECONE_INDEX_NAME=vakilai-judgments

# Optional (for payments, notifications)
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
```

```bash
# Frontend env
cp frontend/.env.local.example frontend/.env.local
# (defaults already set for local dev — no changes needed)
```

---

### 2. Start services

**Option A — Individual terminals (recommended for development)**

```bash
# Terminal 1: MongoDB (if running locally)
mongod --dbpath /usr/local/var/mongodb

# Terminal 2: Backend API (port 8000)
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 3: AI Service (port 8001)
cd ai_service
pip install -r requirements.txt
uvicorn main:app --reload --port 8001

# Terminal 4: Frontend (port 3000)
cd frontend
npm install
npm run dev
```

**Option B — Docker Compose**

```bash
docker-compose up --build
```

Open **http://localhost:3000**

---

## Platform Walkthrough

### For Consumers / Citizens

#### Create an account
1. Go to **http://localhost:3000**
2. Click **Register** tab
3. Select **"Individual / Business"** as your role
4. Fill name, email, password → **Create Account**

#### Ask an AI legal question
1. Click **AI Legal Chat** in the sidebar
2. Type your question — e.g. *"Can my landlord evict me without notice in Maharashtra?"*
3. Optionally set **State** and **Practice Area** filters (top-right Filters button)
4. Press **Enter** or click the send button
5. The AI streams back a cited, jurisdiction-aware answer with:
   - **Confidence score** (percentage bar)
   - **Citation chips** (tap to view judgment)
   - **Legal disclaimer** (always shown)

> **Tip:** Use the starter prompt cards on the empty chat screen for common questions.

#### Generate a legal document
1. Go to **Documents** → **Document Catalog**
2. Browse categories (Rental, Employment, Business, Legal Notices)
3. Click a template (e.g. *Rental Agreement*)
4. Fill in the fields: parties, date, amount, jurisdiction
5. Click **Generate Document** — AI drafts the complete document
6. **Download** or **Preview**

#### Review an existing contract
1. Go to **Documents** → **AI Review** tab
2. Click the upload zone and select your PDF/DOC/TXT file
3. Click **Analyse Document**
4. Review results:
   - **Risk Score** (0–100)
   - **High/Medium/Low risk clauses** with explanations
   - **Suggestions** for each flagged clause

#### Know Your Rights
1. Go to **Rights** in the sidebar
2. Filter by category (Property, Labour, Criminal, Family, Consumer, Constitutional)
3. Click any topic card to expand step-by-step guidance
4. Use **"Ask AI for more details"** to dive deeper in chat
5. **Emergency helplines** are listed at the bottom (Police: 100, Women: 181, Legal Aid: 15100)

#### Find a Lawyer
1. Go to **Find a Lawyer**
2. **Manual search**: Use the search bar and filters (practice area, state, mode, rating)
3. **AI Match** (recommended):
   - Describe your situation in the text box (e.g. *"I need a lawyer for wrongful termination in Delhi, my employer fired me without notice after 3 years of service"*)
   - Click **Match Me** — AI selects top 3–5 advocates with match scores and reasons
4. Click **View Profile** to see full details: bio, courts, education, fees
5. Select a **consultation mode** (Video / Chat / Phone / In Person)
6. Click **Book Now**

---

### For Advocates / Law Firms

#### Create a Pro account
1. Register and select **"Advocate / Lawyer"** as your role
2. After login you are taken to the **Pro Dashboard** automatically

#### Pro Dashboard
Shows at a glance:
- **Active cases**, total clients, monthly revenue, pending invoices
- **Revenue trend chart** (6-month area chart)
- **Upcoming hearings** (next 3)
- **Recent activity** feed

#### Case Management
1. Go to **Cases**
2. Toggle between **Table view** (sortable) and **Kanban view** (drag-friendly columns)
3. Kanban columns: Pending → Active → On Hold → Closed
4. Filter by status or search by case name / client name
5. Click **+ New Case** to create a case with client, court, practice area, hearing dates

#### AI Legal Research
Three modes accessible from the **Research** page:

**Case Search**
- Enter a legal query (e.g. *"bail grounds for NDPS cases"*)
- Filter by court, year, practice area
- Results show citation, court, year, similarity score, and validity badge (Valid / Overruled / Upheld)
- Click **+ Add to memo** to collect judgments for a research memo

**Precedent Finder**
- Paste your case facts in the text box
- Select practice area
- Click **Find Precedents** — AI returns ranked judgments with relevance explanation and key legal principle

**Research Memo**
- Enter a memo topic (e.g. *"Bail jurisprudence under BNSS 2023"*)
- Any judgments added from search are automatically included
- Click **Generate Memo** — produces a structured memo: Executive Summary → Applicable Law → Key Judgments → Legal Principles → Conclusion
- Export as PDF or copy to clipboard

#### Billing & CRM
1. Go to **Billing & CRM**

**Invoices tab**
- View all invoices with status: Draft / Sent / Paid / Overdue
- Filter by status
- **+ New Invoice** opens the invoice builder
- Download GST-compliant PDF invoices

**Time Tracker tab**
- One-click timer per case
- Weekly time log with hours × rate
- Auto-generate invoice from time entries

---

## Account Settings

Go to **Settings** (bottom of sidebar):

| Tab | What you can change |
|-----|---------------------|
| Profile | Name, phone, state, preferred language (10 languages) |
| Notifications | Toggle SMS/email for hearings, payments, documents, AI responses |
| Security | Change password, enable 2FA |
| Plans & Billing | Compare plans, upgrade / downgrade |

### Subscription Plans

| Plan | Price | Best for |
|------|-------|----------|
| Free | ₹0 | 5 AI queries/day, basic templates |
| Basic | ₹499/mo | 50 queries/day, all templates, priority matching |
| Business | ₹2,999/mo | Unlimited queries, AI review, dedicated support |
| Pro (Lawyer) | ₹1,499/mo | Full research suite, case management, CRM, billing |

---

## API Reference (Developers)

### Backend API — http://localhost:8000/api/v1

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Login → JWT token |
| GET | `/users/me` | Current user profile |
| GET | `/marketplace/lawyers` | Search lawyers (query params: practice_area, location, min_rating) |
| POST | `/marketplace/match` | AI lawyer matching |
| CRUD | `/cases` | Case management |
| CRUD | `/clients` | Client management |
| POST | `/documents/upload` | Upload document to S3 |
| GET | `/analytics/pro/summary` | Pro KPI summary |
| POST | `/billing/invoices` | Create invoice |

Interactive docs: **http://localhost:8000/docs**

### AI Service — http://localhost:8001

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/ai/consult/stream` | SSE streaming consultation (query params: query, jurisdiction, practice_area, token) |
| POST | `/ai/consult` | Synchronous consultation |
| POST | `/ai/documents/generate` | Generate document (body: template_id, fields) |
| POST | `/ai/documents/review` | Review document for risks (body: document_text) |
| POST | `/ai/research/search` | Semantic judgment search |
| POST | `/ai/research/precedents` | Precedent finder (body: facts, practice_area) |
| POST | `/ai/research/memo` | Generate research memo |
| POST | `/ai/match/score` | Lawyer-case match score |
| POST | `/ai/match/complexity` | Case complexity assessment |

Interactive docs: **http://localhost:8001/docs**

---

## Architecture

```
Browser (Next.js 14)
    │
    ├── /api/backend/* → FastAPI (port 8000)   ← auth, cases, marketplace, billing
    └── /api/ai/*     → AI Service (port 8001) ← LangGraph agents (Claude)
                              │
                    ┌─────────┴──────────┐
               Anthropic API         Pinecone
               (Claude Sonnet 4.6)   (4M+ judgments)
```

**LangGraph Consultation Pipeline:**
```
User Query → classify_query → retrieve_context → stream_answer → score_confidence → finalize
                  ↓               ↓                   ↓               ↓
           Practice Area    Pinecone/LLM          SSE tokens      0.0–1.0 score
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `ANTHROPIC_API_KEY not set` warning | Add key to `ai_service/.env` |
| Chat returns "Failed to connect" | Ensure AI service is running on port 8001 |
| Login fails with 401 | Check backend is running; verify MongoDB is up |
| CORS error in browser | Ensure `CORS_ORIGINS` in `.env` includes `http://localhost:3000` |
| Pinecone not configured | Research falls back to LLM knowledge (still works) |
| `npm run dev` fails | Run `npm install` first inside `frontend/` |

---

## Emergency Legal Contacts (India)

| Service | Number |
|---------|--------|
| Police | 100 |
| Women Helpline | 181 |
| Child Helpline | 1098 |
| NALSA Legal Aid | 15100 |
| Senior Citizens | 14567 |
| Cyber Crime | 1930 |

---

*VakilAI provides legal information, not legal advice. Always consult a qualified advocate before taking legal action.*
