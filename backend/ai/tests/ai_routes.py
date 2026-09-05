"""
Helper: load the real ai_service route table by importing its FastAPI app.

Importing ai_service only reads its route definitions (no DB connect, no LLM
calls — startup events don't fire on import). Requires the AI_SERVICE venv;
under any other venv the heavy imports (langchain, faiss, slowapi) are missing,
so we skip the whole module cleanly.
"""

import re
import sys
import pathlib

import pytest

_ROUTES = None


def _load():
    global _ROUTES
    if _ROUTES is not None:
        return _ROUTES
    tests_dir = pathlib.Path(__file__).resolve().parent
    backend_root = tests_dir.parents[1]           # tests -> ai -> backend
    aisvc = tests_dir.parents[2] / "ai_service"   # tests -> ai -> backend -> repo
    if not aisvc.exists():
        pytest.skip(f"ai_service not found at {aisvc}", allow_module_level=True)

    # ai_service and backend share top-level module names (config, main, routes,
    # middleware, ...). Drop backend from the path and purge any already-imported
    # colliding modules so ai_service's own versions load cleanly.
    _COLLIDING = ("config", "main", "routes", "agents", "middleware", "providers",
                  "rag", "llm", "database")
    sys.path[:] = [p for p in sys.path if p not in (str(backend_root), str(tests_dir))]
    for name in list(sys.modules):
        if name in _COLLIDING or name.startswith(tuple(f"{c}." for c in _COLLIDING)):
            del sys.modules[name]
    sys.path.insert(0, str(aisvc))  # must win over anything else for `config`, `routes`
    try:
        import main  # noqa: E402  ai_service FastAPI app
    except Exception as exc:  # wrong venv / missing deps
        pytest.skip(
            f"cannot import ai_service app (run this file with the ai_service venv): {exc}",
            allow_module_level=True,
        )
    routes = set()
    for r in main.app.routes:
        for m in (getattr(r, "methods", None) or []):
            routes.add((m.upper(), r.path))
    _ROUTES = routes
    return routes


def _norm(path: str) -> str:
    """Normalise a path to a template: strip query, params -> '*'."""
    path = path.split("?")[0]
    path = re.sub(r"\$\{[^}]+\}", "*", path)  # frontend `${caseId}`
    path = re.sub(r"\{[^}]+\}", "*", path)    # server `{case_id}`
    return path


def route_pairs():
    """Set of (METHOD, exact_path)."""
    return _load()


def route_templates():
    """Set of (METHOD, normalised_path) for param-tolerant matching."""
    return {(m, _norm(p)) for (m, p) in _load()}
