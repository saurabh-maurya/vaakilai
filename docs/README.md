# VakilAI BRD — Team Workstreams

The original `VakilAI_BRD.docx` (v1.0, April 2025) has been split into four parallel workstreams so teams can build independently while staying aligned.

| Document | Owner Team | Scope |
|----------|------------|-------|
| [01_Architecture_Orchestration_Workflow.md](./01_Architecture_Orchestration_Workflow.md) | Platform / DevOps / Tech Leads | System design, service boundaries, workflows, NFRs, roadmap, compliance |
| [02_Frontend.md](./02_Frontend.md) | Frontend & Mobile | Web (Next.js), React Native, UX flows, UI requirements |
| [03_Backend.md](./03_Backend.md) | Backend & Integrations | APIs, databases, payments, notifications, third-party integrations |
| [04_AI.md](./04_AI.md) | AI / ML | LLM, RAG, vector search, document AI, ethics, training data |

## How to Use These Documents

1. **Start with Architecture** — defines service boundaries, data flows, and integration contracts all teams must follow.
2. **Work in parallel** — each team owns its document; cross-team dependencies are called out in an **Integration Points** section in every file.
3. **Trace requirements** — functional requirement IDs (`FR-Axx`, `FR-Bxx`, `FR-Cxx`) are preserved from the source BRD for traceability.

## Source Document

- **Original:** `../VakilAI_BRD.docx`
- **Version:** 1.0 | April 2025
- **Status:** DRAFT — For Review
- **Next Review:** June 2025 (Quarterly)

## Cross-Team Sync Cadence (Recommended)

| Sync | Participants | Focus |
|------|--------------|-------|
| Weekly | All tech leads | API contracts, blockers, schema changes |
| Bi-weekly | Frontend + Backend | UI ↔ API alignment |
| Bi-weekly | Backend + AI | Inference endpoints, RAG pipeline, latency budgets |
| Monthly | All + Product | Roadmap phase gates, KPI review |
