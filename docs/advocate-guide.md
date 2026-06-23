# VakilAI Pro — Advocate & Law Firm Guide

**For:** Advocates, lawyers, solicitors, and law firms enrolled on VakilAI Pro
**Portal:** vakilai.in/pro (Pro subscription required)
**Last updated:** June 2026

---

## What is VakilAI Pro?

VakilAI Pro is a full-featured legal intelligence suite built for practising advocates and law firms. It combines AI-powered legal research, automated drafting, case management, client CRM, billing, and analytics — all in one dark-themed, distraction-free workspace.

---

## Getting Started

### Register as a Lawyer
1. Visit **vakilai.in** and click **Get Started**
2. Select **Lawyer / Law Firm** as your role
3. Enter your Bar Council Enrolment Number
4. Upload your Bar Council certificate (AI-verified)
5. Complete your profile (courts, practice areas, experience, fee structure)
6. Subscribe to **VakilAI Pro** (monthly or annual)

### Pro Dashboard (`/pro/dashboard`)
Your homepage shows:
- Active cases by stage (kanban summary)
- Upcoming hearings (next 7 days)
- Pending client messages
- Contracts and IP assets due for action
- Monthly billing summary
- AI credits used

---

## AI Features (Powered by LangGraph + Claude + Aalap)

---

### 1. AI Legal Chat (`/chat`)

Same as the consumer version but with expanded professional context — get answers appropriate for advocates, including strategy suggestions and citation depth.

---

### 2. AI Research (`/pro/research`)

**What it does:** Search over 4 million+ Indian court judgments using semantic/RAG search. Find precedents, generate research memos, and analyse cited cases.

**How to use:**
1. Go to **AI Research**
2. **Search tab:** Enter a legal question or case facts — e.g. *"anticipatory bail medical grounds"*
   - AI returns the top 10 most relevant judgments with similarity scores
   - Each result shows case name, court, year, decision, key holding
3. **Precedents tab:** Enter a legal proposition to find supporting and opposing precedents
4. **Memo tab:** Select a topic and relevant cases → AI generates a formatted research memo with headings, holdings, and arguments

**RAG Search:** Uses FAISS vector index. Ingest the NyayaAnumana dataset (702k cases) for best results.

---

### 3. Case Outcome Prediction (`/pro/predict`)

**What it does:** AI predicts the likely outcome of a case with confidence score, similar precedents, and reasoning chain.

**How to use:**
1. Go to **Predict Outcome**
2. Fill in: case facts, practice area, court, client's position
3. Click **Predict Outcome**
4. See:
   - **Verdict prediction** (Allow / Dismiss / Partially Allow)
   - **Confidence score** (%)
   - **Reasoning chain** — step-by-step AI analysis
   - **Similar cases** — up to 5 cases from the index with their outcomes
5. Use this for client counselling on litigation risk

**Note:** Predictions are based on indexed historical cases. Add more cases to the FAISS index to improve accuracy.

---

### 4. Judge Analytics (`/pro/judge-analytics`) ⭐ New

**What it does:** Analyse the judicial tendencies of any judge — grant rates, preferred reasoning, distinctive views, and strategic tips for appearing counsel.

**How to use:**
1. Go to **Judge Analytics**
2. Enter the judge's name (e.g. *Justice D.Y. Chandrachud*)
3. Optionally select court and practice area
4. Click **Analyse Judge**
5. The AI analyses indexed cases decided by this judge and returns:
   - Estimated grant/allow rate
   - Key reasoning tendencies (3-5 bullet points)
   - Preferred legal doctrines
   - Notable areas of strong views
   - Strategic tips for advocates
6. Also available: **Court Tendency** analysis for any court over N years

**Prerequisite:** Ingest the NyayaAnumana dataset for meaningful analytics:
```bash
cd ai_service && python -m rag.nyayaanumana_ingester --max-cases 50000
```

---

### 5. Litigation Safety Check (`/pro/safety-check`) ⭐ New

**What it does:** Pre-filing risk analysis for any matter. Checks limitation period, jurisdiction, locus standi, procedural risks, cost estimate, success probability, and alternative remedies.

**How to use:**
1. Go to **Safety Check**
2. Fill in:
   - Case facts and dispute description
   - Proposed relief sought
   - Proposed court/forum
   - Cause of action date (for limitation analysis)
   - Practice area and client type
3. Click **Run Safety Check**
4. The AI returns:
   - **Overall risk level** (Low / Medium / High / Critical) with score 0-100
   - **Limitation status** — is the case within time? Warning if close to expiry
   - **Jurisdiction** — is the chosen court appropriate?
   - **Locus standi** — does the client have standing?
   - **Procedural risks** — specific pitfalls to avoid
   - **Cost estimate** — realistic INR range for the litigation
   - **Success probability** — AI assessment with reasoning
   - **Alternative remedies** — mediation, arbitration, Lok Adalat options
   - **Recommendations** — concrete pre-filing steps

**Use case:** Run before every new brief. Share the safety check PDF with the client during consultation.

---

### 6. Document Comparison — Redline (`/pro/compare`) ⭐ New

**What it does:** Compare two versions of any legal document. Identify additions, deletions, risk changes by clause type, and get an AI recommendation on whether to accept, negotiate, or reject.

**How to use:**
1. Go to **Doc Compare**
2. Paste Document A (original) and Document B (revised)
3. Label each version (e.g. *Client Draft* vs *Opponent Counter*)
4. Optionally specify focus areas: *indemnity, termination, payment*
5. Click **Compare Documents**
6. Review:
   - **Stats:** Total changes, lines added/removed
   - **Executive summary** of changes
   - **Risk Changes by Clause** — each changed clause flagged as increased/decreased/neutral risk
   - **Key Differences** list
   - **Recommendation** — Accept / Negotiate / Reject with reasoning
   - **Line-by-line diff** — expandable HTML redline view

---

### 7. Argument Builder (`/pro/arguments`) — Powered by Aalap

**What it does:** Generate structured arguments for both petitioner and respondent based on case facts and applicable statutes.

**How to use:**
1. Go to **Argument Builder**
2. Enter case facts, legal issues (optional), relevant statutes, and practice area
3. Click **Build Arguments**
4. Review petitioner and respondent arguments in collapsible sections
5. Copy individual arguments or export all to clipboard

---

### 8. Issue Spotter (`/pro/issues`) — Powered by Aalap

**What it does:** Identify all legal issues arising from a set of case facts, including the primary issue for determination and applicable laws.

**How to use:**
1. Go to **Issue Spotter**
2. Paste the case facts / dispute description
3. Optionally select practice area and court
4. Click **Spot Legal Issues**
5. Review:
   - **Primary issue** — the central question for the court
   - **All issues** — numbered list of every legal question raised
   - **Applicable laws** — statutes and sections that apply

---

### 9. Event Timeline (`/pro/timeline`) — Powered by Aalap

**What it does:** Extract a chronological timeline of events from case facts, pleadings, or FIR text.

**How to use:**
1. Go to **Event Timeline**
2. Select source type: **Case Description** or **FIR / Police Report**
3. Paste the source text
4. Click **Extract Timeline**
5. Review the colour-coded vertical timeline with dates, events, and significance notes

**Use case:** Quickly reconstruct a chronology from a complex FIR or judgment for client briefing.

---

### 10. Statute Breakdown (`/pro/statute`) — Powered by Aalap

**What it does:** Break any Indian statute into its essential ingredients, burden of proof, exceptions, punishment, and landmark cases.

**How to use:**
1. Go to **Statute Breakdown**
2. Quick-select a common statute (420 IPC, 138 NI Act, 498A, 302, Article 21) or paste custom text
3. Enter the statute name/reference
4. Click **Analyse Statute**
5. Review:
   - **Essential Ingredients** — each element that must be proved
   - **Burden of Proof** — who must prove what
   - **Punishment/Remedy** — what the court can award
   - **Exceptions & Defences** — statutory defences
   - **Landmark Cases** — key precedents

---

## Case Management

### Cases (`/pro/cases`)

**What it does:** Full case management with kanban/table view — track cases from intake to closure.

**How to use:**
1. Click **Cases** → **New Case**
2. Fill in: case title, client, court, case type, file number, opposing counsel
3. Cases appear on the kanban board (Intake → Active → Hearing → Judgment → Closed)
4. **Drag and drop** cases between stages
5. Inside a case:
   - Add **Hearings** with dates and notes
   - Add **Tasks** with due dates and assigned team member
   - **Timeline** — all events auto-logged
   - **Documents** — attach relevant files
   - **Notes** — private research notes

---

## Client Management

### Client Portal (`/pro/clients`)

**What it does:** Manage your client relationships. Invite clients to their own secure portal, send documents, and exchange messages per case.

**How to use:**
1. Go to **Client Portal**
2. **Add Client** — enter name, email, mobile
3. An invitation is sent to the client to create their account
4. The client logs in and sees only their own cases and documents
5. Use the **Messages** panel to send secure updates per case
6. Share documents directly from the case file

**Client view:** Clients see only their cases, related documents, and messages — nothing else in your system.

---

## Contracts CLM (`/pro/contracts`) ⭐ New

**What it does:** Track the full lifecycle of contracts — from draft to signing to expiry/renewal. Get alerts before contracts expire.

**How to use:**
1. Go to **Contracts CLM**
2. **New Contract** — enter:
   - Title, contract type, parties, value
   - Start date, end date, auto-renew flag
3. Track status through: Draft → Under Review → Pending Sign → Active → Expired/Renewed
4. **Clause Vault** — add extracted clauses with risk level notes
5. **Milestones** — add key milestone dates with reminders
6. Dashboard shows contracts expiring within 30 days in an alert banner

**Use case:** Track all client contracts from one dashboard. Never miss a renewal.

---

## IP Portfolio (`/pro/ip`) ⭐ New

**What it does:** Manage patents, trademarks, copyrights, and designs for yourself and your clients. Track renewal deadlines.

**How to use:**
1. Go to **IP Portfolio**
2. **Add IP Asset** — enter:
   - Title, IP type (patent/trademark/copyright/design/GI tag)
   - Application number, registration number
   - Filing date, expiry date, renewal due date
   - Status, owner name, jurisdiction
3. Filter by IP type to view only trademarks, only patents, etc.
4. Alert banner shows assets with renewal due within 60 days
5. **Action Log** — record prosecution steps (filed response, paid renewal fee, etc.)

---

## Legal News (`/news`) ⭐ New

Same as the individual user version — stay current on Bar & Bench and LiveLaw updates, filter by practice area, search by keyword.

---

## IPC → BNS Converter (`/ipc-bns`) ⭐ New

Same as the individual user version — essential for practitioners updating old pleadings or advising clients on post-July 2024 FIRs under BNS 2023.

---

## Billing & CRM (`/pro/billing`)

**What it does:** Generate invoices, track time, manage retainers, and analyse revenue.

**How to use:**
1. Go to **Billing & CRM**
2. **Invoices tab:** Create invoice for a case — add line items (consultation, drafting, appearance fees)
3. **Time Tracker:** Start/stop timer per case — auto-calculates billable hours
4. **Retainers:** Track retainer balance, deductions, and refill reminders
5. **Analytics:** Monthly revenue chart, outstanding amounts, top clients by revenue

---

## eCourts (`/ecourts`)

Same powerful case tracking available to all users — but with Pro, you also get:
- **Daily Cause List** by court
- Unlimited tracked cases (free plan: 3 cases)
- Bulk import of case numbers
- Team-level case tracking (firm admin can see all team cases)

---

## Settings for Lawyers (`/settings`)

- **Profile:** Bar Council number, court appearances, practice areas, languages, bio
- **Verification Status:** BCI verification badge shown on marketplace
- **Fee Structure:** Consultation fees, modes of payment accepted
- **Team:** Add associates/paralegals (firm_admin role)
- **Notifications:** Hearing reminders, client messages, billing alerts
- **API Keys:** Configure Anthropic API key for self-hosted AI

---

## Marketplace Profile

Your profile appears on **Find a Lawyer** for clients to discover you:
- Photo, bio, Bar Council number (verified badge)
- Practice areas and courts
- Consultation fee and availability
- Client reviews (post-consultation)
- **AI Match Score** shown to clients when searching

To improve your match score: keep your profile complete, respond to consultations promptly, and accumulate positive reviews.

---

## Team & Firm Features (firm_admin role)

- Add team members (associates, paralegals, clerks)
- Assign cases to team members
- View all team's cases in one dashboard
- Restrict access by role (full access vs. read-only)
- Consolidated billing for the firm

---

## AI Model Configuration

By default VakilAI uses Claude (Anthropic). For self-hosted or cost-optimized setups:

```bash
# ai_service/.env
AI_PROVIDER=claude         # or huggingface or ollama
ANTHROPIC_API_KEY=sk-...
AALAP_ENABLED=true         # Enable Aalap (OpenNyAI) for legal tasks
HUGGINGFACE_API_TOKEN=hf_...
```

### Ingest NyayaAnumana Dataset (Recommended)
Improves Case Search, Predict Outcome, and Judge Analytics:
```bash
cd ai_service
python -m rag.nyayaanumana_ingester --max-cases 100000 --resume
```
This streams 702k Indian court cases into the local FAISS index. Run overnight; use `--resume` to continue after interruption.

---

## Privacy for Lawyers

- All case data is private to your account (not visible to other lawyers or clients unless shared)
- Client messages are end-to-end encrypted
- FAISS index is stored locally — case content never sent to third parties
- Anthropic API processes only the text you send; not stored by Anthropic beyond the session

---

## Support for Pro Users

- **Priority support:** 4-hour response time (business hours IST)
- **WhatsApp:** +91-XXXXXXXXXX (Pro subscribers)
- **Email:** pro-support@vakilai.in
- **Dedicated onboarding call:** Available for firm_admin accounts on annual plan

---

## Future Features (Roadmap)

- **Drafting Copilot:** In-document AI assistant while you draft in the editor
- **Court Filing Integration:** e-filing via ICMIS/EFILING for SC and select High Courts
- **AI Deposition Prep:** Generate cross-examination questions from witness statements
- **Client Video Consultations:** Integrated encrypted video (replacing Zoom)
- **Bulk NDA Review:** Upload 50 NDAs — AI flags risky clauses across all
- **Legal Precedent Alerts:** Daily digest of new judgments matching your practice areas
- **Stenography Integration:** Dictate notes; AI formats them into structured case notes
- **Citation Checker:** Verify all citations in a document against the Manupatra/SCC database
- **Cause List Scraper:** Automatic parsing of High Court cause lists via official PDFs
- **Multilingual Research:** Research in Hindi, Tamil, Marathi with automatic translation
