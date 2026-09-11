# VakilAI — Manual Testing Guide

Copy-paste sample data for exercising every screen in the app. Pair this with `USAGE_GUIDE.md` (how to navigate) and `docs/individual-guide.md` / `docs/advocate-guide.md` (what each feature does). This file only covers **what to type into each field**.

Run the stack first:
```bash
cd backend && uvicorn main:app --reload --port 8000        # terminal 1
cd ai_service && uvicorn main:app --reload --port 8001     # terminal 2
cd frontend && npm run dev                                 # terminal 3
```
Open **http://localhost:3000**.

## Read this before you start

1. **Passwords must be strong everywhere**, even though the frontend only enforces 8+ characters. The backend additionally requires 1 uppercase, 1 lowercase, 1 digit, 1 special character. Use `Test@1234` for every account you create in this guide — registration will silently 400 on a weak password that the form let you submit.
2. **Most "required" fields aren't HTML-required** — the app disables the submit button instead of showing a browser validation popup. If a button looks greyed out, you're missing a field, not hitting a bug.
3. **Some sidebar pages are pure redirects** with no form of their own: `/rights` → `/chat` (Know Your Rights tab), `/compliance` → `/company-compliance`, `/pro/predict` → `/pro/case-intelligence`, `/pro/safety-check` → `/pro/case-intelligence`, `/pro/compare` → `/documents`. Don't go looking for a form on those routes.
4. **Practice-area and state lists are not consistent across pages** — some pages use the shared 16-area list (e.g. "Property & Real Estate"), others use a shorter local list (e.g. "Property Law"). Each section below uses the exact wording that page expects.
5. There's no `/login` or `/register` route — both live as tabs on the landing page `/`.

---

## 1. Test accounts

Register these once via the **Sign In / Register** card on `/` (top-right role selector). Use the same password for all: `Test@1234`

| Role (UI label) | Name | Email | Phone | Notes |
|---|---|---|---|---|
| Individual / Business | Priya Mehta | `priya.test@example.com` | `+91 98765 43210` | consumer — use for chat, documents, rights, lawyers, ecourts, etc. |
| Advocate / Lawyer | Adv. Rakesh Sharma | `rakesh.test@example.com` | `+91 91234 56789` | lawyer — use for all `/pro/*` pages |

There's no self-signup option for `admin`, `firm_admin`, or `client_portal` roles (the register form only allows `consumer`/`lawyer`). To test the **Admin** panel or **Client Portal**, promote a user's `role`/`subscription_plan` directly in MongoDB, or use `/admin` → Users tab → edit-user modal once you have one admin account seeded manually:
```js
// mongosh
db.users.updateOne({email: "priya.test@example.com"}, {$set: {role: "admin"}})
```

---

## 2. Auth (`/`)

**Register tab**
| Field | Value |
|---|---|
| Full Name | `Priya Mehta` |
| Phone (optional) | `+91 98765 43210` |
| I am a | `Individual / Business` |
| Email | `priya.test@example.com` |
| Password | `Test@1234` |

**Sign In tab** — same email/password once registered.

---

## 3. Dashboard (`/dashboard`)
Read-only. Click a "Try Asking" chip (e.g. *"Employee rights during termination"*) to jump straight into chat with it pre-filled.

---

## 4. AI Legal Chat (`/chat`)

| Field | Value |
|---|---|
| State / Jurisdiction | `Maharashtra` |
| Practice Area | `Property & Real Estate` |
| Message | `Can my landlord evict me without notice in Mumbai? I've been paying rent on time for 2 years.` |

Follow-up message to test multi-turn: `What if the landlord wants to sell the flat instead?`

**Know Your Rights tab** (toggle at top of empty chat) — click category `Property`, open **Tenant Rights**, click **Ask AI for more details**.

---

## 5. Documents (`/documents`)

### Catalog → search
Type `rent` in the search box — should surface **Rental Agreement**.

### Generate → Rental Agreement
| Field | Value |
|---|---|
| Landlord Name | `Suresh Iyer` |
| Landlord Address | `12, Marine Drive, Mumbai, Maharashtra 400020` |
| Tenant Name | `Priya Mehta` |
| Tenant Address | `45, Andheri West, Mumbai, Maharashtra 400058` |
| Property Address | `Flat 302, Sunrise Apartments, Andheri West, Mumbai 400058` |
| Monthly Rent | `35000` |
| Security Deposit | `100000` |
| Lease Term | `11 months` |
| Lock-in Period | `6 months` |
| Start Date | `2026-10-01` |
| Notice Period | `1 month` |
| Maintenance By | `Tenant` |
| Furnishing | `Semi-furnished` |
| State | `Maharashtra` |
| City | `Mumbai` |

### Generate → Legal Notice (quick alternative test)
| Field | Value |
|---|---|
| Sender Name | `Priya Mehta` |
| Sender Address | `45, Andheri West, Mumbai 400058` |
| Recipient Name | `Suresh Iyer` |
| Recipient Address | `12, Marine Drive, Mumbai 400020` |
| Subject | `Non-refund of security deposit` |
| Facts | `Vacated the rented flat on 15 July 2026 after giving proper notice. Landlord has not refunded the ₹1,00,000 security deposit despite repeated requests.` |
| Relief Sought | `Immediate refund of the full security deposit of ₹1,00,000 within 15 days.` |
| Amount | `100000` |
| Response Days | `15` |
| Advocate Name | *(leave blank)* |
| Notice Date | `2026-09-11` |

### Review (AI Review tab)
Toggle **Paste text**, paste:
```
This Agreement is entered into between the Company and the Employee. The Employee agrees to a non-compete clause of 5 years across India. The Company may terminate employment at any time without notice or severance. All disputes shall be resolved exclusively in the courts of Singapore.
```
Click **Analyse Document** — expect flagged clauses for the 5-year non-compete, no-notice termination, and foreign jurisdiction.

### Compare (Doc Compare tab)
- Doc Type: `Employment Letter`
- Focus areas: `termination, non-compete`
- Document A (Original): paste the same text as above
- Document B (Revised): same text but change "5 years" → "1 year" and "Singapore" → "Mumbai, India"

---

## 6. Rights (`/rights`)
Redirects to `/chat` — see §4 "Know Your Rights tab" above.

---

## 7. Find a Lawyer (`/lawyers`)

**AI Match** textarea:
`I need a lawyer for a property dispute in Mumbai regarding ancestral property partition among four siblings.`

**Manual filters**
| Field | Value |
|---|---|
| Practice Area | `Property & Real Estate` |
| Location / State | `Maharashtra` |
| Consultation Mode | `Video Call` |
| Min Rating | `4.0+` |
| Search box | `Sharma` |

### Lawyer profile / booking (`/lawyers/[id]`)
Open any result, choose consultation mode chip **Video Call**, click **Book Now** (date picker is a stub — expect a "coming soon" note).

---

## 8. Case Search & Case Workspace (`/cases/search`, `/cases/[id]`)

### Case Search
| Field | Value |
|---|---|
| Query | `wrongful termination without notice period, Section 138 NI Act` |
| Practice Area | `Labour Law` |
| Year From | `2018` |
| Year To | `2026` |

Try **Fetch from Indian Kanoon** to index the query, then use the per-result "Ask AI" box: `what did the court say about burden of proof`

### Case Workspace tabs (open any indexed/created case)
| Tab | Field | Value |
|---|---|---|
| Overview (shared facts) | Case Facts | `Employee Priya Mehta was terminated by ABC Pvt Ltd without notice on 1 August 2026 after 3 years of continuous service, in violation of the appointment letter's 2-month notice clause.` |
| Case Intelligence | Mode | `Pre-filing` |
| | Court | `Delhi High Court` |
| | Relief Sought | `Reinstatement with full back wages and damages for wrongful termination` |
| Statute Breakdown | Statute Name | `Section 138, Negotiable Instruments Act` |
| | Statute Text | *(paste the bare section text from Bare Act / Indian Kanoon)* |
| Argument Builder | Issues | `wrongful termination, notice period violation` |
| | Statutes | `Industrial Disputes Act 1947` |
| Notice Drafting | Compliance Days | `15` |
| | Demand | `Reinstate the employee with full back wages within 15 days, failing which legal proceedings will be initiated.` |

---

## 9. Consultation (`/consultation`)

| Field | Value |
|---|---|
| Connect type | `Phone Call` |
| Area of law * | `Family Law` |
| Your state | `Maharashtra` |
| Urgency | `Soon — within 2–3 days` |
| Budget (optional) | `₹1,000–₹3,000` |
| Describe your issue * | `My landlord is refusing to return my ₹50,000 security deposit two months after I vacated the flat in Pune.` |

---

## 10. Compliance (`/compliance`)
Redirects to `/company-compliance` — see §12.

## 11. Compliance Filings (`/compliance-filings`)

**Individual → ITR Filing**
| Field | Value |
|---|---|
| PAN | `ABCDE1234F` |
| Aadhaar | `1234 5678 9012` |
| Financial Year | `2024-25` |
| ITR Type | `ITR-1 Salary/Pension` |
| Salary | `1200000` |
| Business | `0` |
| Capital Gains | `50000` |
| Rental | `240000` |
| Deductions 80C | `150000` |
| Deductions 80D | `25000` |
| TDS Paid | `95000` |

**Company → ROC Filings**: toggle to **Company**, select type `Private Limited`, browse status chips (`pending`, `overdue`) — filters only, no form.

**AI Compliance Assistant**: `What are my pending ROC compliances this month?`

## 12. Company Compliance (`/company-compliance`)

**Corporate Setup tab**
| Field | Value |
|---|---|
| Company Name | `Acme Technologies Pvt Ltd` |

Click **Generate Compliance Calendar**.

**Add Item tab**
| Field | Value |
|---|---|
| Name | `GSTR-3B Filing — September 2026` |
| Category | `GST` |
| Due Date | `2026-10-20` |
| Description | `Monthly GST return for September 2026` |

**Limitation Period tab**
| Field | Value |
|---|---|
| Matter Type | `Cheque bounce (Section 138)` |
| Incident Date | `2026-06-01` |
| Cause of Action | `Cheque dishonoured due to insufficient funds` |

---

## 13. eCourts Tracker (`/ecourts`)

| Field | Value |
|---|---|
| Case Number | `CS/123/2024` |
| Court Type | `High Court` |
| State | `Maharashtra` |
| District / City | pick from cascading dropdown, e.g. `Mumbai` |
| Case Title (optional) | `Priya Mehta vs Suresh Iyer` |
| Court Name | `Bombay High Court` |
| Validate on eCourts | leave unchecked for a quick manual-entry test |

---

## 14. IPC → BNS Converter (`/ipc-bns`)

Try each quick chip: `420`, `302 murder`, `498A cruelty`, `cheating`, `theft`.
Free-text query: `Section 406 criminal breach of trust`
Per-result question box: `Has this section changed under BNS 2023?`

---

## 15. Legal News (`/news`)
Category chip: `Constitutional`. Search box: `Supreme Court collegium`.

---

## 16. Lok Adalat / ODR (`/odr`)

**Step 1 — Describe Dispute**
| Field | Value |
|---|---|
| Matter Type | `Cheque Bounce (Sec 138 NI Act)` |
| Dispute Summary | `Received a cheque of ₹75,000 from a client which bounced due to insufficient funds. Multiple follow-ups have gone unanswered.` |
| Claimant Position | `Cheque was issued for services rendered and payment is legitimately due.` |
| Desired Outcome | `Full payment of ₹75,000 plus applicable interest.` |
| Claim Amount | `75000` |

**Step 3 — Submit**
| Field | Value |
|---|---|
| Claimant Name | `Priya Mehta` |
| Respondent Name | `Suresh Iyer` |
| Preferred Platform | `Lok Adalat (Free)` |

---

## 17. Settings (`/settings`)

**Profile tab**
| Field | Value |
|---|---|
| Name | `Priya Mehta` |
| Phone | `+91 98765 43210` |
| State | `Maharashtra` |
| Language | `Hindi` |

**Security tab**
| Field | Value |
|---|---|
| Current Password | `Test@1234` |
| New Password | `Test@5678` |
| Confirm New Password | `Test@5678` |

**Plans & Billing tab → Annual Company Compliance wizard**
| Field | Value |
|---|---|
| Company Name | `Acme Technologies Pvt Ltd` |
| CIN | `U74999MH2020PTC123456` |
| Company Type | `Private Limited` |
| Incorporation Date | `2020-04-15` |
| Financial Year | `2024-25` |
| Authorized Capital | `500000` |
| Paid-up Capital | `100000` |
| Annual Turnover | `5000000` |
| Registered Address | `21, Nariman Point, Mumbai, Maharashtra 400021` |
| Director 1 Name | `Priya Mehta` |
| Director 1 DIN | `01234567` |
| Director 1 Email | `priya.test@example.com` |
| Director 1 Phone | `+91 98765 43210` |
| Director 1 Designation | `Director` |

---

## 18. Admin (`/admin`, requires `admin` role — see §1)

**Users tab**: search `priya`, filter role `lawyer`, filter status `Active`. Open edit-user modal on any row and set Subscription Plan → `advocate_pro`.

**AI Metrics tab**: click `30` (days).

**Security tab**: click `100` (rows).

**Config & Keys tab → + Custom Key**
| Field | Value |
|---|---|
| Key Name | `TEST_FEATURE_FLAG` |
| Value | `enabled` |

---

## 19. Client Portal (`/client`, requires `client_portal` role)

**Messages tab**: select a case from the dropdown, type `Could you share an update on the hearing scheduled next week?`, press Enter.

---

## Pro suite (`/pro/*`) — log in as the lawyer account from §1

## 20. Pro Dashboard (`/pro/dashboard`)
Read-only. Click **+ New Case** to jump to §21.

## 21. Cases (`/pro/cases`)

| Field | Value |
|---|---|
| Title | `Sharma vs. State of UP` |
| Client Name | `Ranjeet Sharma` |
| Case Number | `WP/2026/1234` |
| Practice Area | `Criminal Law` |
| Court | `Allahabad High Court` |
| Status | `Active` |
| Filing Date | *(defaults to today — leave as-is)* |
| Next Hearing | `2026-10-15` |
| Description | `Writ petition challenging arbitrary suspension from government service without a hearing.` |

Drag the created card across kanban columns (Pending → Active → On Hold → Closed) to test the board.

## 22. Client Portal / CRM (`/pro/clients`)

| Field | Value |
|---|---|
| Name | `Ranjeet Sharma` |
| Email | `ranjeet.sharma@example.com` |
| Phone | `+91 99887 66554` |
| Invite to client portal | checked |
| Note (shown after checking invite) | `Welcome! You can track your case status and message me directly from here.` |

Messaging box: `Your writ petition has been filed. Next hearing is on 15 October 2026.`

## 23. AI Research (`/pro/research`)

**Precedent Finder**
| Field | Value |
|---|---|
| Facts | `Client was denied anticipatory bail by the Sessions Court in an NDPS case involving recovery of 50g of contraband. Client has no prior criminal record.` |
| Practice Area | `Criminal Law` |

**Research Memo**
| Field | Value |
|---|---|
| Memo Topic | `Bail jurisprudence under BNSS 2023` |

## 24. Predict Outcome (`/pro/predict`)
Redirects to `/pro/case-intelligence` — see §33, mode **Outcome Prediction**.

## 25. Doc Compare (`/pro/compare`)
Redirects to `/documents` — see §5 "Compare" section.

## 26. Contracts CLM (`/pro/contracts`)

| Field | Value |
|---|---|
| Title | `Service Agreement — ABC Corp` |
| Contract Type | `Service` |
| Value | `500000` |
| Parties | `ABC Corporation, VakilAI Legal Services` |
| Start Date | `2026-09-15` |
| End Date | `2027-09-14` |
| Description | `Annual retainer for legal advisory services.` |
| Auto-renew | checked |

Status filter to test: `Pending Sign`.

## 27. IP Portfolio (`/pro/ip`)

| Field | Value |
|---|---|
| Title | `VakilAI Logo — Trademark Application` |
| IP Type | `Trademark` |
| Status | `Pending` |
| Application Number | `TM-2026-004521` |
| Registration Number | *(leave blank — not yet registered)* |
| Owner Name | `VakilAI Technologies Pvt Ltd` |
| Jurisdiction | `India` |
| Expiry Date | `2036-09-15` |
| Renewal Due Date | `2036-07-15` |

## 28. Issue Spotter (`/pro/issues`)

| Field | Value |
|---|---|
| Case Facts | `Landlord served a 15-day eviction notice to a tenant of 5 years without citing any grounds under the Rent Control Act. Tenant has paid rent on time throughout and holds a valid lease agreement running until 2027.` |
| Practice Area | `Property Law` |
| Court | `District Court` |

## 29. Judge Analytics (`/pro/judge-analytics`)

| Field | Value |
|---|---|
| Judge Name | `Justice D.Y. Chandrachud` |
| Court | `Supreme Court of India` |
| Practice Area | `Constitutional Law` |

## 30. Litigation Safety Check (`/pro/safety-check`)
Redirects to `/pro/case-intelligence` — see §33, mode **Pre-Filing Risk Check**.

## 31. Notice Drafting (`/pro/notices`)

| Field | Value |
|---|---|
| Notice Type | `Cheque Bounce (S.138 NI Act)` |
| Sender Name | `Mr. Rakesh Sharma` |
| Sender Details | `Advocate, Bar Council No. UP/1234/2015` |
| Recipient Name | `M/s ABC Traders` |
| Recipient Details | `Shop No. 12, Sadar Bazaar, Lucknow, UP 226001` |
| Facts | `Cheque No. 000123 dated 01/08/2026 for ₹4,50,000 issued by M/s ABC Traders towards payment for goods supplied was dishonoured on presentation due to insufficient funds. A demand notice was sent on 05/08/2026 which has gone unanswered.` |
| Demand | `Pay ₹4,50,000 with 18% interest per annum within the statutory period, failing which criminal proceedings under Section 138 NI Act will be initiated.` |
| Compliance Days | `15` |
| Advocate Name | `Rakesh Sharma` |
| Extra | `Mention the earlier reminder dated 05/08/2026` |

## 32. Statute Breakdown (`/pro/statute`)

Quick-select chip: **Section 138 NI Act — Cheque Bounce**, or manually:
| Field | Value |
|---|---|
| Statute Name | `Section 138, Negotiable Instruments Act` |
| Statute Text | *(paste bare section text, e.g. from Indian Kanoon)* |

## 33. Case Intelligence (`/pro/case-intelligence`)

**Pre-Filing Risk Check mode**
| Field | Value |
|---|---|
| Parties | `Ravi Kumar vs. State of Rajasthan` |
| Background | `Client's shop was sealed by the municipal authority without prior notice or hearing, citing an unpaid property tax dispute that is itself under appeal.` |
| Court | `Rajasthan High Court` |
| Practice Area | `Constitutional Law` |
| Relief Sought | `Writ of mandamus directing the authority to de-seal the shop pending appeal` |
| Statutes | `Article 226 Constitution of India, Rajasthan Municipalities Act` |
| Cause of Action Date | `2026-08-20` |
| Client Type | `Individual` |

**Outcome Prediction mode** — toggle mode, keep Parties/Background, leave Court/Relief Sought blank (not required in this mode).

## 34. Event Timeline (`/pro/timeline`)

Toggle source: `FIR / Police Report`
| Field | Value |
|---|---|
| Case Description | `FIR No. 245/2026 dated 12 June 2026 at PS Hazratganj. Complainant states that on 10 June 2026 at approximately 9 PM, the accused forcibly entered the premises and assaulted the complainant. Complainant was taken to hospital on the same night and discharged on 13 June 2026. Police recorded statement on 14 June 2026.` |

## 35. Argument Builder (`/pro/arguments`)

| Field | Value |
|---|---|
| Case Facts | `Employee was terminated without notice or severance after 4 years of service, allegedly for performance issues that were never documented or communicated during employment.` |
| Issues | `wrongful termination, lack of due process` |
| Statutes | `Industrial Disputes Act 1947, Section 25F` |
| Practice Area | `Labour Law` |

## 36. Billing & CRM (`/pro/billing`)

**New Invoice**
| Field | Value |
|---|---|
| Client Name | `Ranjeet Sharma` |
| Client Email | `ranjeet.sharma@example.com` |
| Due Date | *(defaults to +30 days — leave as-is)* |
| GST Rate | `18%` |
| Line Item 1 — Description | `Consultation fee` |
| Line Item 1 — Hrs | `1` |
| Line Item 1 — Rate (₹) | `3000` |
| Line Item 2 — Description | `Drafting of writ petition` |
| Line Item 2 — Hrs | `5` |
| Line Item 2 — Rate (₹) | `2000` |
| Notes | `Payment due within 30 days via bank transfer or UPI.` |
| Send email | checked |
| Email To | *(prefilled with your login email — leave as-is)* |

Click **Create & Send**.

---

## Quick smoke-test checklist

For a fast pass instead of full coverage, hit these ten in order — they touch auth, both AI providers, document generation, and the two most complex forms:

1. Register consumer account (§2)
2. Ask a question in AI Chat (§4)
3. Generate a Rental Agreement (§5)
4. Run AI Review on the pasted risky-clause text (§5)
5. AI Match a lawyer (§7)
6. Submit a Consultation request (§9)
7. Register/login as lawyer, create a Case (§21)
8. Run Case Intelligence in Pre-Filing mode (§33)
9. Draft a Notice (§31)
10. Create and send an Invoice (§36)
