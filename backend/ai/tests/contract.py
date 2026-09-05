"""
Single source of truth for the backend ⇄ ai_service AI contract.

Every AI feature the backend uses is listed here as the CORRECT (method, path)
on ai_service plus the arguments the backend client passes. Two test files read
this file:

  * test_client_contract.py      (run with the BACKEND venv)
      asserts backend/ai/client.py actually sends each request to this path/method.

  * test_ai_service_endpoints.py  (run with the AI_SERVICE venv)
      asserts ai_service really exposes each (method, path).

Keep this file dependency-free (no imports of `config` or app code) so it loads
under either virtualenv.
"""

# Features that are wired end-to-end. Each entry:
#   feature   – human label
#   client    – function name in backend/ai/client.py
#   kwargs    – arguments the backend passes (drives the client test)
#   method    – HTTP method hitting ai_service
#   path      – exact ai_service route
#   body_has  – top-level JSON fields the request body must contain (POST only)
WORKING = [
    {
        "feature": "Legal consultation (WhatsApp / ODR)",
        "client": "consult",
        "kwargs": {"query": "What is Section 138 of the NI Act?", "language": "en",
                   "conversation_history": []},
        "method": "POST",
        "path": "/ai/consult",
        "body_has": ["query"],
    },
    {
        "feature": "Lawyer match score (single lawyer)",
        "client": "match_score",
        "kwargs": {"case_description": "Cheque bounce dispute for ₹4,00,000 under Sec 138.",
                   "lawyer_id": "64f0c0ffee0000000000abcd",
                   "lawyer_profile": {"name": "Adv. R. Rao",
                                      "practice_areas": ["Criminal", "Banking"],
                                      "experience_years": 12}},
        "method": "POST",
        "path": "/ai/match/score",
        "body_has": ["case_description", "lawyer_id"],
    },
    {
        "feature": "Case complexity / tier",
        "client": "case_complexity",
        "kwargs": {"case_facts": "Multi-party partition suit with contested wills.",
                   "practice_area": "Civil"},
        "method": "POST",
        "path": "/ai/match/complexity",
        "body_has": ["case_description"],
    },
    {
        "feature": "Outcome prediction",
        "client": "predict_outcome",
        "kwargs": {"case_type": "Civil", "jurisdiction": "Delhi High Court",
                   "facts_summary": "Breach of a commercial supply contract.",
                   "judge_id": None},
        "method": "POST",
        "path": "/ai/predict",
        "body_has": ["case_facts"],
    },
    {
        "feature": "Judge analytics / insights",
        "client": "judge_insights",
        "kwargs": {"judge_id": "Justice D.Y. Chandrachud"},
        "method": "POST",
        "path": "/ai/judge-analytics/judge",
        "body_has": ["judge_name"],
    },
]

# Features that are intentionally NOT wired end-to-end. The tests assert these
# stay documented (e.g. the OCR path must NOT exist server-side) so nobody
# assumes they work.
KNOWN_GAPS = [
    {
        "feature": "Document OCR",
        "client": "ocr_document",
        "method": "POST",
        "path": "/ai/documents/ocr",
        "reason": "ai_service exposes no OCR route (only /ai/documents/generate and "
                  "/review). The backend trigger is a graceful no-op until an OCR "
                  "endpoint is built server-side.",
    },
    {
        "feature": "Lawyer list matching",
        "client": None,
        "method": None,
        "path": None,
        "reason": "ai_service has no ranked-list endpoint. backend /marketplace/match "
                  "now builds a candidate pool from the DB and calls /ai/match/score "
                  "once per lawyer. A dedicated server-side ranking endpoint is still "
                  "a possible future optimisation.",
    },
]

# ── Frontend (direct → ai_service on :8001) ─────────────────────────────────────
# The frontend calls ai_service directly via `aiApi` (base http://localhost:8001,
# NO /ai prefix). test_frontend_contract.py auto-discovers every aiApi path in the
# source and asserts it resolves to a real route. These two are still broken and
# are expected (xfail) to keep the suite green while documenting the gap.
FRONTEND_KNOWN_BROKEN = {
    # path-as-written-in-source : reason
    "/safety-check": "Wrong path AND body: should be /ai/safety/check; page's SharedInput "
                     "(parties/background/…) does not supply the required case_facts / "
                     "proposed_relief / court. Needs a request+response adapter, not just a "
                     "path fix. File: src/app/pro/case-intelligence/page.tsx",
    "/predict": "Missing /ai prefix AND body: /ai/predict needs case_facts; the page sends "
                "SharedInput fields instead. Needs an adapter. "
                "File: src/app/pro/case-intelligence/page.tsx",
}
