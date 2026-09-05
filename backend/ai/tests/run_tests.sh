#!/usr/bin/env bash
# Run the AI contract test suite. Each file runs under the venv that has its deps.
#   - client contract  -> backend venv   (imports backend config + ai.client)
#   - endpoint + frontend contract -> ai_service venv (imports ai_service app)
set -u

REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
BACKEND_PY="$REPO/backend/venv/bin/python"
AISVC_PY="$REPO/ai_service/venv/bin/python"
T="$REPO/backend/ai/tests"

fail=0

echo "==> backend client contract (backend venv)"
"$BACKEND_PY" -m pytest "$T/test_client_contract.py" -q || fail=1

echo "==> ai_service endpoint existence (ai_service venv)"
"$AISVC_PY" -m pytest "$T/test_ai_service_endpoints.py" -q -p no:cacheprovider || fail=1

echo "==> frontend → ai_service path contract (ai_service venv)"
"$AISVC_PY" -m pytest "$T/test_frontend_contract.py" -q -p no:cacheprovider || fail=1

echo
[ "$fail" -eq 0 ] && echo "ALL AI CONTRACT TESTS PASSED" || echo "SOME TESTS FAILED"
exit "$fail"
