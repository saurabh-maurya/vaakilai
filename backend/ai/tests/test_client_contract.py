"""
Backend AI client contract tests.   RUN WITH THE BACKEND VENV.

    backend/venv/bin/python -m pytest backend/ai/tests/test_client_contract.py -v

Verifies that backend/ai/client.py sends each AI feature to the CORRECT
ai_service path + method + body, attaches the internal service key, and handles
failures gracefully. No network: httpx is stubbed with a MockTransport that
captures the outgoing request.
"""

import asyncio
import json

import httpx
import pytest

import config
from ai import client as ai_client
from contract import WORKING, KNOWN_GAPS


def _run_capturing(call, *, status=200, response_json=None):
    """Invoke an async client call with httpx stubbed; return (result, request)."""
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["request"] = request
        return httpx.Response(status, json=response_json if response_json is not None else {"ok": True})

    transport = httpx.MockTransport(handler)
    real_client = httpx.AsyncClient

    def factory(*args, **kwargs):
        kwargs.pop("transport", None)
        return real_client(*args, transport=transport, **kwargs)

    orig = ai_client.httpx.AsyncClient
    ai_client.httpx.AsyncClient = factory
    try:
        result = asyncio.run(call())
    finally:
        ai_client.httpx.AsyncClient = orig
    return result, captured.get("request")


@pytest.fixture(autouse=True)
def _internal_key(monkeypatch):
    """Ensure the internal service key is set so we can assert the header."""
    monkeypatch.setattr(config.settings, "internal_service_key", "test-internal-key", raising=False)
    monkeypatch.setattr(config.settings, "ai_service_url", "http://ai-service.test:8001", raising=False)


@pytest.mark.parametrize("spec", WORKING, ids=[s["feature"] for s in WORKING])
def test_client_hits_correct_endpoint(spec):
    fn = getattr(ai_client, spec["client"])
    result, request = _run_capturing(lambda: fn(**spec["kwargs"]))

    assert request is not None, "client made no HTTP request"
    assert request.method == spec["method"], (
        f"{spec['client']} used {request.method}, expected {spec['method']}"
    )
    assert request.url.path == spec["path"], (
        f"{spec['client']} hit {request.url.path}, expected {spec['path']}"
    )
    # internal service key must be attached for service-to-service auth bypass
    assert request.headers.get("X-Internal-Key") == "test-internal-key"

    if spec["method"] == "POST":
        body = json.loads(request.content.decode() or "{}")
        for field in spec["body_has"]:
            assert field in body and body[field] not in (None, ""), (
                f"{spec['client']} body missing required field '{field}': {body}"
            )
    # 200 returns the parsed dict
    assert result == {"ok": True}


@pytest.mark.parametrize("spec", WORKING, ids=[s["feature"] for s in WORKING])
def test_client_returns_none_on_server_error(spec):
    fn = getattr(ai_client, spec["client"])
    result, _ = _run_capturing(lambda: fn(**spec["kwargs"]), status=500)
    assert result is None, f"{spec['client']} should return None on HTTP 500"


def test_ocr_targets_documented_missing_path():
    """OCR endpoint doesn't exist server-side; client still targets the agreed path."""
    gap = next(g for g in KNOWN_GAPS if g["client"] == "ocr_document")
    _, request = _run_capturing(lambda: ai_client.ocr_document("doc1", "grid://x"), status=404)
    assert request.url.path == gap["path"]
    assert request.method == "POST"
