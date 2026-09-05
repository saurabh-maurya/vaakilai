"""
pytest bootstrap for the AI test suite.

Adds the backend root (so `import config` and `import ai.client` resolve) and
the tests dir (so `import contract` resolves) to sys.path. The ai_service tests
insert the ai_service root themselves and must be run under the ai_service venv.
"""

import sys
from pathlib import Path

TESTS_DIR = Path(__file__).resolve().parent
BACKEND_ROOT = TESTS_DIR.parents[1]  # backend/ai/tests -> backend

for p in (str(BACKEND_ROOT), str(TESTS_DIR)):
    if p not in sys.path:
        sys.path.insert(0, p)
