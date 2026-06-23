# VakilAI BRD — Frontend & Mobile

> **Team:** Frontend Engineering, Mobile Engineering, UX/UI Design  
> **Related docs:** [Architecture](./01_Architecture_Orchestration_Workflow.md) · [Backend](./03_Backend.md) · [AI](./04_AI.md)

---

## 1. Scope & Ownership

This document covers all user-facing interfaces across three product layers:

| Product | Platforms | Primary Users |
|---------|-----------|---------------|
| VakilAI Assistant | Web, Mobile, WhatsApp (beta) | Consumers, SMEs |
| VakilAI Connect | Web, Mobile | Clients seeking lawyers |
| VakilAI Pro | Web (primary), Mobile (companion) | Lawyers, law firms |

### Technology Stack

| Platform | Stack | Notes |
|----------|-------|-------|
| Web | React.js + Next.js | SSR for SEO, fast UX |
| Mobile | React Native (Android + iOS) | Single codebase |
| Design System | Shared component library | Consistent across web + mobile |

---

## 2. Design Principles

- **Multilingual-first:** English, Hindi + 8 regional languages (Tamil, Telugu, Kannada, Bengali, Marathi, Gujarati, Malayalam, Punjabi)
- **Accessibility:** Voice input for low-literacy users; responsive layouts for Tier-2/3 devices
- **Trust & transparency:** AI confidence scores, disclaimers, and source citations visible in UI
- **WhatsApp-native patterns:** Familiar chat UX for consumer-facing flows
- **Progressive disclosure:** Simple consumer flows; power-user density for Pro dashboard

---

## 3. Module A — VakilAI Assistant (Consumer UI)

### 3.1 AI Consultation Interface

| Req ID | Requirement | UI Behavior |
|--------|-------------|-------------|
| FR-A01 | Q&A across 25+ practice areas | Chat interface with practice area picker / auto-detect |
| FR-A02 | Multilingual support (10 languages) | Language selector + auto-detect; real-time translation display |
| FR-A03 | Contextual follow-up questions | Inline follow-up prompts below AI responses |
| FR-A04 | Jurisdictional awareness | State/jurisdiction selector; state-specific guidance badges |
| FR-A05 | AI confidence scoring + disclaimer | Confidence meter + persistent disclaimer banner |
| FR-A06 | Voice input | Mic button with speech-to-text in multiple languages |

**Screens:**
- Chat home (new conversation / history)
- Active consultation thread
- Practice area & jurisdiction picker
- Consultation history list

### 3.2 Legal Document Generation UI

| Req ID | Requirement | UI Behavior |
|--------|-------------|-------------|
| FR-A07 | 150+ document types | Searchable document type catalog with categories |
| FR-A08 | Guided questionnaire | Multi-step wizard with progress indicator |
| FR-A09 | Download PDF / Word | Download buttons with preview before export |
| FR-A10 | Document Review Mode | Upload zone → highlighted clauses view → suggested edits panel |

**Screens:**
- Document catalog (grid/list with filters)
- Questionnaire wizard (step-by-step form)
- Document preview & editor
- Upload & review interface

### 3.3 Legal Rights Awareness UI

| Req ID | Requirement | UI Behavior |
|--------|-------------|-------------|
| FR-A11 | "Know Your Rights" explainer | Topic cards (tenant, employee, consumer, DV, arrest, bail) |
| FR-A12 | Step-by-step process guides | Numbered step flows with checklists (FIR, consumer complaint, bail, RTI) |

**Screens:**
- Rights hub (topic grid)
- Topic detail with expandable sections
- Process guide with step tracker

### 3.4 Escalation to Lawyer (Connect Handoff)

- "Talk to a Lawyer" CTA within chat when AI confidence is low or user requests
- Pre-filled context passed to marketplace matching screen
- Seamless transition preserving conversation history (with user consent)

---

## 4. Module B — VakilAI Connect (Marketplace UI)

### 4.1 Lawyer Discovery & Profiles

| Req ID | Requirement | UI Behavior |
|--------|-------------|-------------|
| FR-B01 | Lawyer onboarding (Bar Council verification) | Multi-step onboarding wizard for lawyers |
| FR-B02 | Detailed lawyer profiles | Profile page: practice areas, courts, experience, education, reviews |
| FR-B03 | AI-verified badge | Trust badges (verified, background check, DigiLocker) |
| FR-B04 | Availability calendar | Calendar widget with real-time slot booking |
| FR-B05 | AI matching (top 3–5 lawyers) | Match results card with match score & reasoning |
| FR-B06 | Manual search with filters | Filter panel: location, language, specialization, fee, rating |
| FR-B07 | Case complexity scoring | Complexity indicator with recommended lawyer tier |

**Screens:**
- Lawyer search & filter
- AI match results
- Lawyer profile detail
- Availability calendar & booking

### 4.2 Consultation Modes UI

| Req ID | Requirement | UI Behavior |
|--------|-------------|-------------|
| FR-B08 | Video consultation | In-app video call UI (no external app) |
| FR-B09 | Chat consultation | Secure async messaging thread |
| FR-B10 | Phone consultation | Click-to-call button with consent for recording |
| FR-B11 | In-person appointment | Map integration + office visit booking |
| FR-B12 | Document review requests | Upload + SLA countdown + written opinion display |

**Screens:**
- Consultation mode selector
- Video call room (Twilio/Agora embed)
- Chat consultation thread
- Appointment confirmation with map

### 4.3 Payments UI

| Req ID | Requirement | UI Behavior |
|--------|-------------|-------------|
| FR-B13 | Payment gateway (UPI, cards, wallets) | Razorpay checkout embed |
| FR-B14 | Escrow payment | Payment held indicator; release on completion |
| FR-B15 | Transparent fee display | Per-session / hourly / retainer pricing cards |
| FR-B16 | GST-compliant invoicing | Invoice download from consultation history |
| FR-B17 | Subscription retainer plans | Plan selector with hour pool tracker |

**Screens:**
- Checkout / payment
- Subscription plan picker
- Payment history & invoices
- Escrow status tracker

---

## 5. Module C — VakilAI Pro (Lawyer Dashboard UI)

### 5.1 AI Legal Research Interface

| Req ID | Requirement | UI Behavior |
|--------|-------------|-------------|
| FR-C01 | Semantic search (4M+ judgments) | Search bar with filters (court, year, practice area) |
| FR-C02 | Case law summarization | 3-line summary card per judgment |
| FR-C03 | Precedent finder | Fact input form → ranked precedent list with similarity score |
| FR-C04 | Statute tracker alerts | Notification bell + alert feed for amendments |
| FR-C05 | Citation validator | Inline validation badges (valid / overruled / upheld) |
| FR-C06 | Research memos | Memo generator with editable output panel |

**Screens:**
- Research search & results
- Judgment detail with summary
- Precedent finder input & results
- Research memo editor

### 5.2 AI Document Drafting UI

| Req ID | Requirement | UI Behavior |
|--------|-------------|-------------|
| FR-C07 | 500+ templates | Template library with categories |
| FR-C08 | AI auto-fill from case facts | Fact input sidebar → live document preview |
| FR-C09 | Clause library | Searchable clause repository with insert action |
| FR-C10 | Real-time co-drafting | Multi-cursor collaborative editor |
| FR-C11 | Version history | Timeline sidebar with diff view |

**Screens:**
- Template library
- Document editor (collaborative)
- Clause library browser
- Version history panel

### 5.3 Case Management Dashboard

| Req ID | Requirement | UI Behavior |
|--------|-------------|-------------|
| FR-C12 | Central case dashboard | Kanban/table view: client, type, court, next date, status |
| FR-C13 | Hearing date tracker | Calendar with eCourts-synced dates |
| FR-C14 | Automated reminders | Reminder config panel (SMS/WhatsApp/email) |
| FR-C15 | Case file management | Folder tree upload & organization |
| FR-C16 | Case timeline | Chronological event feed |
| FR-C17 | Task management | Task board with assignee, deadline, status |

**Screens:**
- Case dashboard (list/kanban)
- Case detail (tabs: overview, files, timeline, tasks)
- Hearing calendar
- Task board

### 5.4 CRM Interface

| Req ID | Requirement | UI Behavior |
|--------|-------------|-------------|
| FR-C18 | Client profiles | Client detail: contact, cases, comms, billing |
| FR-C19 | Automated client updates | Update scheduler with message preview |
| FR-C20 | Intake forms | Form builder + client-facing form renderer |
| FR-C21 | Client portal access | Separate client-facing portal (status, docs, dates) |
| FR-C22 | NPS / satisfaction tracking | Survey trigger config + results dashboard |

**Screens:**
- Client list & detail
- Intake form builder
- Client portal (consumer-facing sub-app)
- Satisfaction dashboard

### 5.5 Billing & Practice Management UI

| Req ID | Requirement | UI Behavior |
|--------|-------------|-------------|
| FR-C23 | Time tracking | One-click timer widget per case/task |
| FR-C24 | Invoice generation | Invoice builder with branded letterhead preview |
| FR-C25 | Payment tracking | Outstanding / received / overdue dashboard |
| FR-C26 | Expense tracking | Per-case expense log |
| FR-C27 | Profitability analytics | Revenue charts by case, client, practice area |

**Screens:**
- Time tracker (floating widget)
- Invoice list & generator
- Payment dashboard
- Analytics dashboard

### 5.6 Analytics & Insights UI

| Req ID | Requirement | UI Behavior |
|--------|-------------|-------------|
| FR-C28 | Litigation analytics | Win rate charts by court, judge, counsel, area |
| FR-C29 | Judge behavior insights | Judge profile cards with pattern visualizations |
| FR-C30 | Case outcome prediction | Probability gauge with contributing factors |
| FR-C31 | Practice growth dashboard | Monthly KPI cards: clients, revenue, cases filed/closed |

**Screens:**
- Analytics hub
- Judge insights explorer
- Outcome prediction detail
- Growth dashboard

---

## 6. Authentication & Onboarding UI

| Flow | Requirements |
|------|-------------|
| Consumer signup | Email/phone OTP, social login optional |
| Lawyer onboarding | Bar Council number → DigiLocker → profile setup → practice areas |
| MFA | OTP + biometric (mobile) |
| Subscription selection | Plan comparison page per user type |

---

## 7. Frontend Non-Functional Requirements

| Category | Requirement | Target |
|----------|-------------|--------|
| Performance | First Contentful Paint (web) | < 1.5s |
| Performance | Time to Interactive (web) | < 3s |
| Performance | Mobile app cold start | < 2s |
| Accessibility | WCAG 2.1 AA compliance | Required |
| Accessibility | Language support | 10 languages with RTL-safe layouts |
| Devices | Supported platforms | Web (Chrome, Safari, Firefox), Android 8+, iOS 14+ |
| Offline | Mobile offline mode | View cached consultations & documents |
| Security | Client-side | No sensitive data in localStorage; secure token handling |

---

## 8. Integration Points (Dependencies on Other Teams)

### 8.1 Backend APIs Required

| Feature | API Endpoint (Draft) | Owner |
|---------|---------------------|-------|
| Auth & sessions | `POST /auth/login`, `POST /auth/mfa` | Backend |
| User profile | `GET/PUT /users/{id}` | Backend |
| Consultations | `POST /consultations`, `GET /consultations/{id}` | Backend |
| Payments | `POST /payments/checkout`, `GET /payments/{id}` | Backend |
| Cases & CMS | `CRUD /cases`, `GET /cases/{id}/hearings` | Backend |
| CRM | `CRUD /clients`, `POST /clients/{id}/updates` | Backend |
| Billing | `POST /invoices`, `GET /billing/summary` | Backend |
| Notifications | WebSocket `/ws/notifications` | Backend |
| File upload | `POST /documents/upload` (presigned S3 URL) | Backend |

### 8.2 AI Service APIs Required

| Feature | API Endpoint (Draft) | Owner |
|---------|---------------------|-------|
| AI consultation | `POST /ai/consult` (streaming SSE) | AI |
| Document generation | `POST /ai/documents/generate` | AI |
| Document review | `POST /ai/documents/review` | AI |
| Legal research | `POST /ai/research/search` | AI |
| Precedent finder | `POST /ai/research/precedents` | AI |
| Research memo | `POST /ai/research/memo` | AI |
| Lawyer matching score | `POST /ai/match/score` | AI |
| Case complexity | `POST /ai/case/complexity` | AI |

### 8.3 Third-Party SDKs (Frontend)

| Integration | SDK / Library | Used In |
|-------------|---------------|---------|
| Razorpay | razorpay-checkout | Connect payments |
| Twilio / Agora | Video SDK | Consultation video calls |
| Google Maps | Maps SDK | In-person appointment |
| Speech-to-Text | Web Speech API / native | Voice input (FR-A06) |

---

## 9. MVP Frontend Deliverables (Phase 2 — Month 4–6)

| Priority | Deliverable | Platform |
|----------|-------------|----------|
| P0 | AI chatbot interface | Web + Android |
| P0 | Lawyer search & booking | Web + Android |
| P0 | Lawyer onboarding portal | Web |
| P0 | Payment checkout | Web + Android |
| P1 | Document generation wizard | Web |
| P1 | Basic Pro case dashboard | Web |
| P2 | iOS app | Mobile |
| P2 | Client portal | Web |

---

## 10. Frontend KPIs

| KPI | Year 1 Target |
|-----|---------------|
| Page load time (P95) | < 3s |
| Mobile crash rate | < 0.5% |
| Consultation booking completion (funnel) | > 70% |
| Document wizard completion rate | > 80% |
| Lawyer onboarding completion | > 60% |

---

*Source: VakilAI_BRD.docx v1.0 — Sections 3, 5 (UI-facing), 6 (accessibility NFRs), 7.1 (frontend stack)*
