"""
Frontend → ai_service path contract.   RUN WITH THE AI_SERVICE VENV.

    ai_service/venv/bin/python -m pytest backend/ai/tests/test_frontend_contract.py -v

The frontend calls ai_service directly via `aiApi` (base http://localhost:8001,
NO /ai prefix). This test scans the frontend source, extracts every aiApi path,
and asserts each resolves to a real ai_service route. It auto-catches missing
"/ai" prefixes and wrong sub-paths (the class of bug that broke the Pro AI
pages). Paths in FRONTEND_KNOWN_BROKEN are xfail'd — documented, not yet wired.
"""

import re
import pathlib

import pytest

from contract import FRONTEND_KNOWN_BROKEN
from ai_routes import route_templates, _norm

REPO = pathlib.Path(__file__).resolve().parents[3]
FRONTEND_SRC = REPO / "frontend" / "src"

_CALL_RE = re.compile(
    r"""aiApi\.(get|post|put|delete)      # method
        (?:<[^>]*>)?                       # optional TS generic
        \(\s*['"`]([^'"`]+)['"`]""",       # the path literal
    re.VERBOSE,
)


def _discover_calls():
    calls = []
    if not FRONTEND_SRC.exists():
        return calls
    for path in FRONTEND_SRC.rglob("*.ts*"):
        text = path.read_text(encoding="utf-8", errors="ignore")
        for m in _CALL_RE.finditer(text):
            method, raw = m.group(1).upper(), m.group(2)
            calls.append((method, raw, path.relative_to(REPO).as_posix()))
    return calls


CALLS = _discover_calls()


def test_frontend_calls_were_found():
    assert CALLS, f"no aiApi calls discovered under {FRONTEND_SRC}"


@pytest.mark.parametrize(
    "method,raw,src",
    CALLS,
    ids=[f"{m}:{p}" for (m, p, _s) in CALLS],
)
def test_frontend_path_resolves(method, raw, src):
    if raw in FRONTEND_KNOWN_BROKEN:
        pytest.xfail(f"{src}: {FRONTEND_KNOWN_BROKEN[raw]}")
    templates = route_templates()
    assert (method, _norm(raw)) in templates, (
        f"{src}: aiApi.{method.lower()}('{raw}') does not resolve to any ai_service "
        f"route. Did it lose the '/ai' prefix or use a wrong sub-path?"
    )
