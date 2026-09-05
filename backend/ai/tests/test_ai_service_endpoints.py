"""
ai_service endpoint-existence tests.   RUN WITH THE AI_SERVICE VENV.

    ai_service/venv/bin/python -m pytest backend/ai/tests/test_ai_service_endpoints.py -v

Asserts that ai_service really exposes every (method, path) the backend client
depends on, and that the known-missing OCR route is genuinely absent. This is
the test that catches "backend calls a path ai_service doesn't have".
"""

import pytest

from contract import WORKING, KNOWN_GAPS
from ai_routes import route_pairs

ROUTES = route_pairs()


@pytest.mark.parametrize("spec", WORKING, ids=[s["feature"] for s in WORKING])
def test_backend_endpoint_exists(spec):
    pair = (spec["method"], spec["path"])
    assert pair in ROUTES, (
        f"ai_service is missing {pair} needed by backend client '{spec['client']}'. "
        f"Available AI routes: {sorted(p for m, p in ROUTES if p.startswith('/ai'))}"
    )


def test_ocr_route_is_absent():
    """Documents the KNOWN GAP: no OCR endpoint exists server-side."""
    gap = next(g for g in KNOWN_GAPS if g["client"] == "ocr_document")
    assert (gap["method"], gap["path"]) not in ROUTES, (
        "An OCR endpoint now exists — wire ai.client.ocr_document to it and move "
        "this feature from KNOWN_GAPS to WORKING in contract.py."
    )
