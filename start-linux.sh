#!/usr/bin/env bash
# Re-exec under bash if called with sh/dash (nvm and echo -e require bash)
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi
# =============================================================================
# VakilAI — Linux Startup Script  (Amazon EC2 Ubuntu / Ubuntu 22.04+)
# =============================================================================
# Usage:
#   bash start-linux.sh          # development mode (hot-reload)
#   bash start-linux.sh --prod   # production mode (npm run build + npm start)
#
# Prerequisites:
#   bash setup-linux.sh must have been run at least once.
#
# Logs are written to /tmp/vakilai-*.log
# PIDs are saved to /tmp/vakilai.pids  (read by stop.sh)
# =============================================================================

set -uo pipefail   # -u catches unbound vars; -o pipefail catches pipe failures
                   # NO -e — we handle errors ourselves so one failure doesn't
                   # abort everything

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
AI="$ROOT/ai_service"
FRONTEND="$ROOT/frontend"

LOG_DIR="/tmp"
BACKEND_LOG="$LOG_DIR/vakilai-backend.log"
AI_LOG="$LOG_DIR/vakilai-ai.log"
FRONTEND_LOG="$LOG_DIR/vakilai-frontend.log"
PID_FILE="/tmp/vakilai.pids"

# ── Parse args ─────────────────────────────────────────────────────────────────
PROD_MODE=false
for arg in "$@"; do
  case "$arg" in
    --prod|--production) PROD_MODE=true ;;
  esac
done

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[VakilAI]${RESET} $*"; }
success() { echo -e "${GREEN}[VakilAI]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[VakilAI]${RESET} $*"; }
error()   { echo -e "${RED}[VakilAI] ERROR:${RESET} $*"; }
fatal()   { error "$*"; exit 1; }
step()    { echo -e "\n${BOLD}${CYAN}━━━ $* ━━━${RESET}"; }

# ── Banner ─────────────────────────────────────────────────────────────────────
echo -e "${BOLD}${CYAN}"
echo "  ╔══════════════════════════════════════╗"
echo "  ║          VakilAI Platform            ║"
if $PROD_MODE; then
echo "  ║   India's Legal AI — Production      ║"
else
echo "  ║   India's Legal AI — Dev Startup     ║"
fi
echo "  ╚══════════════════════════════════════╝"
echo -e "${RESET}"

# ── Load nvm (must happen before any node/npm check) ──────────────────────────
NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck source=/dev/null
  source "$NVM_DIR/nvm.sh"
fi

# ── Preflight checks ──────────────────────────────────────────────────────────
step "Preflight checks"

[ -f "$ROOT/.env" ]                  || fatal ".env not found. Run: bash setup-linux.sh"
[ -f "$BACKEND/venv/bin/uvicorn" ]   || fatal "Backend venv missing. Run: bash setup-linux.sh"
[ -f "$AI/venv/bin/uvicorn" ]        || fatal "AI service venv missing. Run: bash setup-linux.sh"
[ -d "$FRONTEND/node_modules" ]      || fatal "Frontend node_modules missing. Run: bash setup-linux.sh"

if ! command -v python3 &>/dev/null; then
  fatal "python3 not found. Run: bash setup-linux.sh"
fi
success "python3 $(python3 --version | awk '{print $2}')"

# Safe node version check (handles missing / malformed version string)
NODE_MAJOR=0
if command -v node &>/dev/null; then
  _raw="$(node --version 2>/dev/null || true)"
  _stripped="${_raw#v}"
  _major="${_stripped%%.*}"
  [[ "$_major" =~ ^[0-9]+$ ]] && NODE_MAJOR="$_major"
fi

if [ "$NODE_MAJOR" -lt 18 ]; then
  # Try nvm switch before giving up
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    nvm use 20 2>/dev/null || nvm use 18 2>/dev/null || true
    _raw="$(node --version 2>/dev/null || true)"
    _major="${_raw#v}"; _major="${_major%%.*}"
    [[ "$_major" =~ ^[0-9]+$ ]] && NODE_MAJOR="$_major"
  fi
  [ "$NODE_MAJOR" -ge 18 ] || fatal "Node.js 18+ required (found v${NODE_MAJOR:-?}). Run: bash setup-linux.sh"
fi
success "node $(node --version)"

if ! command -v npm &>/dev/null; then
  fatal "npm not found. Run: bash setup-linux.sh"
fi
success "npm $(npm --version)"

# ── Sync .env to services ─────────────────────────────────────────────────────
# Only overwrite if root .env is newer than the service copy
for TARGET in "$BACKEND/.env" "$AI/.env"; do
  if [ ! -f "$TARGET" ] || [ "$ROOT/.env" -nt "$TARGET" ]; then
    cp "$ROOT/.env" "$TARGET"
    info "Synced .env → $TARGET"
  fi
done

# ── Helper: kill process on a port ────────────────────────────────────────────
# Tries fuser (psmisc) → lsof → ss (iproute2 — always present on modern Linux)
kill_port() {
  local PORT="$1"
  if command -v fuser &>/dev/null; then
    fuser -k "${PORT}/tcp" 2>/dev/null || true
  elif command -v lsof &>/dev/null; then
    lsof -ti:"$PORT" 2>/dev/null | xargs -r kill -9 2>/dev/null || true
  else
    # ss is part of iproute2 — always available on Ubuntu / Amazon Linux
    local PIDS
    PIDS=$(ss -tlnp 2>/dev/null | grep ":${PORT} " | grep -oP 'pid=\K[0-9]+' || true)
    [ -n "$PIDS" ] && echo "$PIDS" | xargs -r kill -9 2>/dev/null || true
  fi
}

# ── Clear ports ───────────────────────────────────────────────────────────────
step "Clearing ports 8000, 8001, 3000"
for PORT in 8000 8001 3000; do
  kill_port "$PORT"
  warn "  Port $PORT cleared"
done
sleep 1

# ── Rotate logs ───────────────────────────────────────────────────────────────
for LOG in "$BACKEND_LOG" "$AI_LOG" "$FRONTEND_LOG"; do
  # Keep last 5000 lines of any previous run, then truncate
  if [ -f "$LOG" ] && [ -s "$LOG" ]; then
    tail -5000 "$LOG" > "${LOG}.prev" 2>/dev/null || true
  fi
  : > "$LOG"   # truncate for fresh run
done

# ── Start Backend ─────────────────────────────────────────────────────────────
step "Starting Backend API  (port 8000)"
cd "$BACKEND"
nohup "$BACKEND/venv/bin/uvicorn" main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers 1 \
  >> "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
disown $BACKEND_PID
cd "$ROOT"
info "Backend PID: $BACKEND_PID  →  $BACKEND_LOG"

# ── Start AI Service ──────────────────────────────────────────────────────────
step "Starting AI Service  (port 8001)"
cd "$AI"
nohup "$AI/venv/bin/uvicorn" main:app \
  --host 0.0.0.0 \
  --port 8001 \
  --workers 1 \
  >> "$AI_LOG" 2>&1 &
AI_PID=$!
disown $AI_PID
cd "$ROOT"
info "AI Service PID: $AI_PID  →  $AI_LOG"

# ── Start Frontend ────────────────────────────────────────────────────────────
step "Starting Frontend  (port 3000)"
cd "$FRONTEND"

if $PROD_MODE; then
  # Production: build first if .next is missing or stale, then npm start
  if [ ! -d "$FRONTEND/.next" ]; then
    info "No production build found — running npm run build (this may take 2-3 minutes)..."
    npm run build >> "$FRONTEND_LOG" 2>&1 \
      || { error "npm run build failed — check $FRONTEND_LOG"; }
  else
    info "Using existing production build (.next exists). Pass --prod to force rebuild."
    info "To rebuild: rm -rf $FRONTEND/.next && bash start-linux.sh --prod"
  fi
  nohup npm start >> "$FRONTEND_LOG" 2>&1 &
else
  nohup npm run dev >> "$FRONTEND_LOG" 2>&1 &
fi

FRONTEND_PID=$!
disown $FRONTEND_PID
cd "$ROOT"
info "Frontend PID: $FRONTEND_PID  →  $FRONTEND_LOG"

# ── Save PIDs (read by stop.sh / stop-linux.sh) ────────────────────────────────
echo "$BACKEND_PID $AI_PID $FRONTEND_PID" > "$PID_FILE"

# ── Wait for services to become healthy ───────────────────────────────────────
step "Waiting for services to be ready"

# Returns 0 when URL responds 2xx, 1 on timeout
wait_for() {
  local NAME="$1" URL="$2" TIMEOUT="${3:-60}"
  local i=0
  while [ "$i" -lt "$TIMEOUT" ]; do
    if curl -sf --max-time 2 "$URL" -o /dev/null 2>/dev/null; then
      return 0
    fi
    # Check if the process is still alive; bail early if it died
    local PID="${4:-}"
    if [ -n "$PID" ] && ! kill -0 "$PID" 2>/dev/null; then
      return 2   # process exited
    fi
    sleep 1
    i=$((i + 1))
  done
  return 1   # timeout
}

# Backend (60s timeout)
if wait_for "Backend" "http://localhost:8000/health" 60 "$BACKEND_PID"; then
  success "Backend     ✓  http://localhost:8000  (docs: /docs)"
else
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    error "Backend     ✗  process exited — last 20 lines of $BACKEND_LOG:"
    tail -20 "$BACKEND_LOG" | sed 's/^/    /'
  else
    error "Backend     ✗  timed out (still running — check $BACKEND_LOG)"
  fi
fi

# AI Service (60s timeout)
if wait_for "AI Service" "http://localhost:8001/health" 60 "$AI_PID"; then
  success "AI Service  ✓  http://localhost:8001  (docs: /docs)"
else
  if ! kill -0 "$AI_PID" 2>/dev/null; then
    error "AI Service  ✗  process exited — last 20 lines of $AI_LOG:"
    tail -20 "$AI_LOG" | sed 's/^/    /'
  else
    error "AI Service  ✗  timed out (still running — check $AI_LOG)"
  fi
fi

# Frontend (180s — first Next.js compile on EC2 can take ~2-3 min)
if wait_for "Frontend" "http://localhost:3000" 180 "$FRONTEND_PID"; then
  success "Frontend    ✓  http://localhost:3000"
else
  if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    error "Frontend    ✗  process exited — last 20 lines of $FRONTEND_LOG:"
    tail -20 "$FRONTEND_LOG" | sed 's/^/    /'
  else
    warn  "Frontend    — still compiling (Next.js cold start can take >3 min on EC2)"
    warn  "              Check progress: tail -f $FRONTEND_LOG"
  fi
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════╗"
echo -e "║   VakilAI is running                             ║"
echo -e "╚══════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  ${BOLD}URLs:${RESET}"
echo -e "    Frontend   →  http://localhost:3000"
echo -e "    Backend    →  http://localhost:8000   (API docs: /docs)"
echo -e "    AI Service →  http://localhost:8001   (API docs: /docs)"
echo ""
echo -e "  ${BOLD}PIDs:${RESET}  Backend: $BACKEND_PID | AI: $AI_PID | Frontend: $FRONTEND_PID"
echo ""
echo -e "  ${BOLD}Logs:${RESET}"
echo -e "    tail -f $BACKEND_LOG"
echo -e "    tail -f $AI_LOG"
echo -e "    tail -f $FRONTEND_LOG"
echo ""
echo -e "  ${BOLD}Stop all services:${RESET}"
echo -e "    bash $ROOT/stop.sh"
echo ""

# ── Tail logs (Ctrl+C detaches; services keep running) ─────────────────────────
echo -e "${CYAN}━━━ Live logs — Ctrl+C to detach (services keep running) ━━━${RESET}"
trap 'echo -e "\n${CYAN}[VakilAI]${RESET} Detached from logs. Services are still running. Stop with: bash $ROOT/stop.sh"' INT
tail -f "$BACKEND_LOG" "$AI_LOG" "$FRONTEND_LOG"
