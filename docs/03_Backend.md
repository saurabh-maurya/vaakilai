# VakilAI BRD — Backend & Integrations

> **Team:** Backend Engineering, DevOps, Integration Engineering  
> **Related docs:** [Architecture](./01_Architecture_Orchestration_Workflow.md) · [Frontend](./02_Frontend.md) · [AI](./04_AI.md)

---

## 1. Scope & Ownership

Backend owns all server-side logic, data persistence, third-party integrations, and API contracts consumed by Frontend and AI services.

### Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| REST APIs | Node.js (Express/Fastify) | High-throughput API layer |
| AI/ML Microservices | Python (FastAPI) | AI pipeline hosting (owned by AI team, deployed by Backend) |
| Primary Database | PostgreSQL | ACID, relational integrity |
| Document Store | MongoDB | Flexible schema for case files, documents |
| File Storage | AWS S3 (ap-south-1) | Data localization |
| Message Queue | AWS SQS / SNS | Async event processing |
| Cache | Redis | Session, rate limiting, hot data |
| Orchestration | AWS EKS (Kubernetes) | Container deployment |
| CI/CD | GitHub Actions | Automated pipelines |
| Monitoring | Datadog + Sentry | Observability |

---

## 2. Microservice Architecture

### 2.1 Service Map

```
┌──────────────────────────────────────────────────────────────┐
│                      API Gateway                              │
│            (Rate limiting, Auth, Request routing)             │
└────┬─────────┬──────────┬──────────┬──────────┬─────────────┘
     │         │          │          │          │
┌────▼───┐ ┌───▼────┐ ┌───▼─────┐ ┌──▼─────┐ ┌──▼──────────┐
│ User   │ │Market- │ │Practice │ │Notifi- │ │ Integration │
│Service │ │place   │ │Mgmt     │ │cation  │ │ Service     │
│        │ │Service │ │Service  │ │Service │ │             │
└────┬───┘ └───┬────┘ └───┬─────┘ └──┬─────┘ └──┬──────────┘
     │         │          │          │          │
┌────▼─────────▼──────────▼──────────▼──────────▼─────────────┐
│  PostgreSQL  │  MongoDB  │  Redis  │  S3  │  External APIs  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Service Responsibilities

| Service | Domain | Key Entities |
|---------|--------|--------------|
| **user-service** | Auth, profiles, subscriptions | Users, Sessions, Subscriptions, Roles |
| **marketplace-service** | Lawyer marketplace, consultations | Lawyers, Profiles, Consultations, Reviews, Escrow |
| **practice-mgmt-service** | Case management, CRM, billing | Cases, Clients, Tasks, Invoices, TimeEntries |
| **notification-service** | Multi-channel alerts | Notifications, Templates, DeliveryLogs |
| **integration-service** | External API adapters | eCourts, Bar Council, DigiLocker, Razorpay |
| **document-service** | File storage & metadata | Documents, Versions, OCRJobs |

---

## 3. Module B — VakilAI Connect (Backend)

### 3.1 Lawyer Profiles & Verification

| Req ID | Requirement | Backend Implementation |
|--------|-------------|----------------------|
| FR-B01 | Bar Council registration verification | `integration-service` → Bar Council API; store verification status |
| FR-B02 | Detailed lawyer profiles | `marketplace-service` → PostgreSQL `lawyer_profiles` table |
| FR-B03 | AI-verified badge + DigiLocker | `integration-service` → DigiLocker API; background check workflow |
| FR-B04 | Dynamic availability calendar | `marketplace-service` → `availability_slots` with real-time sync |

**API Endpoints (Draft):**
```
POST   /api/v1/lawyers/onboard
GET    /api/v1/lawyers/{id}
PUT    /api/v1/lawyers/{id}/profile
POST   /api/v1/lawyers/{id}/verify          → Bar Council + DigiLocker
GET    /api/v1/lawyers/{id}/availability
PUT    /api/v1/lawyers/{id}/availability
```

### 3.2 Smart Lawyer Matching

| Req ID | Requirement | Backend Implementation |
|--------|-------------|----------------------|
| FR-B05 | AI matching algorithm | `marketplace-service` calls `ai-service` for scoring; returns top 3–5 |
| FR-B06 | Manual search with filters | PostgreSQL full-text + indexed filters (location, language, fee, rating) |
| FR-B07 | Case complexity scoring | `marketplace-service` → `ai-service` complexity endpoint |

**API Endpoints (Draft):**
```
POST   /api/v1/marketplace/match             → AI-assisted matching
GET    /api/v1/marketplace/search            → Filtered search
POST   /api/v1/marketplace/complexity-score  → Proxy to AI service
```

### 3.3 Consultation Management

| Req ID | Requirement | Backend Implementation |
|--------|-------------|----------------------|
| FR-B08 | Video consultation | Twilio/Agora room creation via `integration-service` |
| FR-B09 | Chat consultation | WebSocket-based secure messaging in `marketplace-service` |
| FR-B10 | Phone consultation | Click-to-call via Twilio; recording with consent flag |
| FR-B11 | In-person appointment | Booking entity + Google Maps coordinates |
| FR-B12 | Document review requests | Upload to S3 → assign to lawyer → SLA timer → opinion storage |

**API Endpoints (Draft):**
```
POST   /api/v1/consultations
GET    /api/v1/consultations/{id}
PUT    /api/v1/consultations/{id}/status
POST   /api/v1/consultations/{id}/video-room
POST   /api/v1/consultations/{id}/messages        → WebSocket
POST   /api/v1/consultations/{id}/document-review
```

### 3.4 Payments & Transactions

| Req ID | Requirement | Backend Implementation |
|--------|-------------|----------------------|
| FR-B13 | Payment gateway (UPI, cards, wallets) | Razorpay integration in `integration-service` |
| FR-B14 | Escrow-based payment | Escrow account with scheduled commercial bank; release on completion |
| FR-B15 | Transparent fee display | Pricing rules engine in `marketplace-service` |
| FR-B16 | GST-compliant invoicing | Invoice generation with GST fields; PDF via `document-service` |
| FR-B17 | Subscription retainer plans | `user-service` subscription management with hour pool tracking |

**API Endpoints (Draft):**
```
POST   /api/v1/payments/checkout
POST   /api/v1/payments/escrow/hold
POST   /api/v1/payments/escrow/release
GET    /api/v1/payments/{id}
GET    /api/v1/invoices/{id}
POST   /api/v1/subscriptions
GET    /api/v1/subscriptions/{id}/usage
```

---

## 4. Module C — VakilAI Pro (Backend)

### 4.1 Case Management System

| Req ID | Requirement | Backend Implementation |
|--------|-------------|----------------------|
| FR-C12 | Central case dashboard | `practice-mgmt-service` → `cases` table with aggregated views |
| FR-C13 | Hearing date tracker | `integration-service` → eCourts API sync (cron + webhook) |
| FR-C14 | Automated reminders | `notification-service` → SMS/WhatsApp/email 24h/48h before hearing |
| FR-C15 | Case file management | `document-service` → S3 with folder structure per case |
| FR-C16 | Case timeline | Event-sourced timeline in MongoDB `case_events` collection |
| FR-C17 | Task management | `tasks` table with assignee, deadline, status, case FK |

**API Endpoints (Draft):**
```
CRUD   /api/v1/cases
GET    /api/v1/cases/{id}/hearings
GET    /api/v1/cases/{id}/timeline
GET    /api/v1/cases/{id}/files
POST   /api/v1/cases/{id}/files
CRUD   /api/v1/cases/{id}/tasks
POST   /api/v1/cases/sync-ecourts              → Manual + scheduled sync
```

### 4.2 Client Relationship Management

| Req ID | Requirement | Backend Implementation |
|--------|-------------|----------------------|
| FR-C18 | Complete client profiles | `clients` table linked to cases, communications, billing |
| FR-C19 | Automated client updates | Scheduled jobs via `notification-service` |
| FR-C20 | Intake forms | Form schema in MongoDB; submission handler |
| FR-C21 | Client portal access | Role-based access: client role sees own cases only |
| FR-C22 | NPS tracking | Survey trigger on case milestones; store responses |

**API Endpoints (Draft):**
```
CRUD   /api/v1/clients
GET    /api/v1/clients/{id}/cases
POST   /api/v1/clients/{id}/updates
CRUD   /api/v1/intake-forms
POST   /api/v1/intake-forms/{id}/submit
GET    /api/v1/portal/cases                    → Client portal (scoped)
POST   /api/v1/surveys/nps
```

### 4.3 Billing & Practice Management

| Req ID | Requirement | Backend Implementation |
|--------|-------------|----------------------|
| FR-C23 | Time tracking | `time_entries` with start/stop timestamps per case/task |
| FR-C24 | Invoice generation | GST-compliant invoice builder; branded PDF generation |
| FR-C25 | Payment tracking | Payment status dashboard with aging buckets |
| FR-C26 | Expense tracking | `expenses` table per case with receipt upload |
| FR-C27 | Profitability analytics | Aggregation queries / materialized views |

**API Endpoints (Draft):**
```
POST   /api/v1/time-entries
GET    /api/v1/time-entries?case_id={id}
POST   /api/v1/invoices
GET    /api/v1/invoices?status={status}
POST   /api/v1/expenses
GET    /api/v1/analytics/profitability
GET    /api/v1/analytics/revenue
```

### 4.4 Analytics Data Pipeline

| Req ID | Requirement | Backend Implementation |
|--------|-------------|----------------------|
| FR-C28 | Litigation analytics | Aggregated win rates from case outcomes + eCourts data |
| FR-C29 | Judge behavior insights | Judge entity with decision pattern aggregations |
| FR-C30 | Case outcome prediction | Proxy to `ai-service` prediction endpoint |
| FR-C31 | Practice growth dashboard | KPI aggregation service with monthly rollups |

**API Endpoints (Draft):**
```
GET    /api/v1/analytics/litigation
GET    /api/v1/analytics/judges/{id}
POST   /api/v1/analytics/predict-outcome       → Proxy to AI
GET    /api/v1/analytics/growth
```

---

## 5. User & Auth Service

### 5.1 Authentication

| Requirement | Implementation |
|-------------|----------------|
| MFA + OTP | TOTP + SMS OTP via `notification-service` |
| Biometric (mobile) | Device-level; backend validates device tokens |
| Role-based access | Roles: `consumer`, `lawyer`, `firm_admin`, `client_portal`, `admin` |
| Session management | JWT + refresh tokens; Redis session store |

**API Endpoints (Draft):**
```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/mfa/verify
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
```

### 5.2 Subscription Management

| Plan | Backend Logic |
|------|---------------|
| Freemium (5 free queries/month) | Query counter per user; reset monthly |
| VakilAI Basic (₹499/mo) | Unlimited AI + 1 lawyer call/month |
| VakilAI Business (₹2,999/mo) | Unlimited AI + 5 lawyer hours + contract review |
| VakilAI Pro (₹1,499/mo) | Full lawyer productivity suite |
| VakilAI Firm (₹6,999/mo) | Team plan 5–50 lawyers |

---

## 6. Notification Service

### 6.1 Channels

| Channel | Provider | Use Cases |
|---------|----------|-----------|
| SMS | AWS SNS | OTP, hearing reminders |
| Email | AWS SES | Invoices, case updates, onboarding |
| WhatsApp | WhatsApp Business API | Client updates, hearing reminders, chatbot beta |
| Push | FCM / APNs | Mobile app notifications |
| WebSocket | Internal | Real-time consultation chat, live updates |

### 6.2 Event-Driven Notifications

| Event | Recipients | Channels | Timing |
|-------|------------|----------|--------|
| `consultation.booked` | Lawyer | WhatsApp, Push | Immediate |
| `hearing.reminder` | Lawyer + Client | SMS, WhatsApp, Email | 48h + 24h before |
| `payment.received` | Lawyer | Email, Push | Immediate |
| `case.status.updated` | Client | WhatsApp, Portal | Immediate |
| `document.ready` | User | Push, Email | Immediate |
| `statute.amended` | Subscribed lawyers | Email, Push | Daily digest |

---

## 7. External Integrations

### 7.1 Integration Catalog

| Integration | Provider | Service Owner | Priority |
|-------------|----------|---------------|----------|
| Bar Council Verification | Bar Council API | integration-service | P0 (MVP) |
| eCourts Case Tracking | eCourts API | integration-service | P1 (Phase 3) |
| DigiLocker Identity | DigiLocker API | integration-service | P0 (MVP) |
| Payments | Razorpay | integration-service | P0 (MVP) |
| Video Calls | Twilio / Agora | integration-service | P0 (MVP) |
| OCR | AWS Textract | document-service | P1 |
| File Storage | AWS S3 (ap-south-1) | document-service | P0 |
| Email | AWS SES | notification-service | P0 |
| SMS | AWS SNS | notification-service | P0 |
| WhatsApp | WhatsApp Business API | notification-service | P1 |

### 7.2 eCourts API Integration (Phase 3)

```
Scheduled Job (every 6h):
  FOR each active case WITH eCourts case number:
    CALL eCourts API → GET case status, next hearing date
    IF hearing date changed:
      EMIT event: case.hearing.updated
      UPDATE cases table
      TRIGGER notification-service reminders
```

### 7.3 Razorpay Escrow Flow

```
1. Client initiates payment → Razorpay order created
2. Payment captured → Funds held in escrow account
3. Consultation marked complete (by client or auto-timeout)
4. Escrow release triggered → Funds transferred to lawyer (minus commission)
5. GST invoice generated for both parties
```

---

## 8. Data Model (Core Entities)

### 8.1 PostgreSQL (Relational)

```
users, user_roles, subscriptions
lawyer_profiles, lawyer_verifications, availability_slots
consultations, consultation_messages, reviews
cases, case_hearings, tasks
clients, client_communications
time_entries, invoices, invoice_line_items, expenses, payments
escrow_transactions
```

### 8.2 MongoDB (Document)

```
case_files, case_events (timeline)
intake_form_schemas, intake_form_submissions
document_metadata, document_versions
notification_templates, notification_logs
analytics_aggregates
```

### 8.3 S3 Buckets

```
vakilai-documents/     → User uploads, generated docs, case files
vakilai-invoices/      → Generated PDF invoices
vakilai-recordings/    → Consultation recordings (encrypted)
```

---

## 9. Backend Non-Functional Requirements

| Category | Requirement | Target |
|----------|-------------|--------|
| Performance | REST API response (non-AI) | < 500ms (P95) |
| Performance | Payment processing | < 2s |
| Scalability | Concurrent API requests | 100,000+ |
| Availability | Service uptime | 99.9% SLA |
| Security | Encryption at rest | AES-256 |
| Security | Encryption in transit | TLS 1.3 |
| Security | Attorney-client privilege | E2E encryption on consultation messages |
| Compliance | Data localization | All data in ap-south-1 (Mumbai) |
| Compliance | DPDP 2023 | Consent management, data retention policies, DPO |
| Compliance | GST | Automated GST calculation on all transactions |
| Compliance | RBI escrow | Razorpay PA license; escrow with SCB |

---

## 10. Integration Points (Dependencies)

### 10.1 AI Service (Internal)

| Backend Need | AI Endpoint | When |
|--------------|-------------|------|
| Lawyer match scoring | `POST /ai/match/score` | On match request |
| Case complexity | `POST /ai/case/complexity` | On match request |
| Outcome prediction | `POST /ai/analytics/predict` | On analytics request |
| Document OCR trigger | `POST /ai/documents/ocr` | On file upload |
| Consultation (proxied) | `POST /ai/consult` | Frontend calls via API gateway |

### 10.2 Frontend Contracts

- All APIs versioned under `/api/v1/`
- OpenAPI 3.0 spec maintained in repo (`/api-specs/`)
- WebSocket endpoints for real-time chat and notifications
- Presigned S3 URLs for direct client uploads (no file through API server)

---

## 11. MVP Backend Deliverables (Phase 2 — Month 4–6)

| Priority | Deliverable | Service |
|----------|-------------|---------|
| P0 | Auth + user management | user-service |
| P0 | Lawyer onboarding + Bar Council verification | marketplace-service + integration-service |
| P0 | Consultation booking + escrow payments | marketplace-service + integration-service |
| P0 | Razorpay integration | integration-service |
| P0 | Basic notification (SMS + email) | notification-service |
| P1 | Case management CRUD | practice-mgmt-service |
| P1 | Document upload to S3 | document-service |
| P1 | WhatsApp notifications | notification-service |
| P2 | eCourts API sync | integration-service |
| P2 | CRM + billing | practice-mgmt-service |

---

## 12. Backend KPIs

| KPI | Year 1 Target |
|-----|---------------|
| API uptime | 99.9% |
| Non-AI API latency (P95) | < 500ms |
| Payment success rate | > 98% |
| eCourts sync accuracy | > 95% |
| Notification delivery rate | > 99% |
| Zero data breaches | 0 incidents |

---

*Source: VakilAI_BRD.docx v1.0 — Sections 5.2, 5.3 (backend-facing), 6 (security/compliance NFRs), 7.1 (backend stack), 8 (revenue/subscriptions), 11 (regulatory)*
