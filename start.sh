#!/bin/bash

# VakilAI — Startup Script
# Starts Backend (8000), AI Service (8001), and Next.js Frontend (3000)

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
AI="$ROOT/ai_service"
FRONTEND="$ROOT/frontend"

BACKEND_LOG="/tmp/vakilai-backend.log"
AI_LOG="/tmp/vakilai-ai.log"
FRONTEND_LOG="/tmp/vakilai-frontend.log"

# ── Colors ────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[VakilAI]${RESET} $1"; }
success() { echo -e "${GREEN}[VakilAI]${RESET} $1"; }
warn()    { echo -e "${YELLOW}[VakilAI]${RESET} $1"; }
error()   { echo -e "${RED}[VakilAI]${RESET} $1"; }

# ── Banner ────────────────────────────────────────────────────────────────
echo -e "${BOLD}${CYAN}"
echo "  ╔══════════════════════════════════════╗"
echo "  ║          VakilAI Platform            ║"
echo "  ║   India's Legal AI — Startup Script  ║"
echo "  ╚══════════════════════════════════════╝"
echo -e "${RESET}"

# ── Prereqs ───────────────────────────────────────────────────────────────
if [ ! -f "$ROOT/.env" ]; then
  error ".env not found. Run setup first:"
  echo "  bash $ROOT/setup.sh"
  exit 1
fi

if ! command -v python3 &>/dev/null; then
  error "python3 not found. Install Python 3.12+."
  exit 1
fi

# Load nvm if available and ensure Node >= 18
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  source "$HOME/.nvm/nvm.sh"
fi

if ! command -v node &>/dev/null; then
  error "node not found. Run bash setup.sh first."
  exit 1
fi

NODE_MAJOR=$(node --version | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  warn "Node.js $(node --version) too old (< 18). Attempting nvm switch..."
  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    nvm use 20 2>/dev/null || nvm use 18 2>/dev/null || { error "Node 18+ not installed. Run bash setup.sh first."; exit 1; }
  else
    error "Node.js 18+ required for Next.js. Run bash setup.sh to upgrade."
    exit 1
  fi
fi

if [ ! -d "$FRONTEND/node_modules" ]; then
  error "Frontend dependencies not installed. Run setup first:"
  echo "  bash $ROOT/setup.sh"
  exit 1
fi

# ── Kill existing processes on our ports ─────────────────────────────────
info "Clearing ports 8000, 8001, 3000..."
for PORT in 8000 8001 3000; do
  PIDS=$(lsof -ti:$PORT 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "$PIDS" | xargs kill -9 2>/dev/null || true
    warn "  Killed existing process on port $PORT"
  fi
done
sleep 1

# ── Copy shared .env to each service ─────────────────────────────────────
cp "$ROOT/.env" "$BACKEND/.env"
cp "$ROOT/.env" "$AI/.env"

# ── Start Backend ─────────────────────────────────────────────────────────
info "Starting Backend API on port 8000..."
cd "$BACKEND"
"$BACKEND/venv/bin/uvicorn" main:app \
  --host 0.0.0.0 --port 8000 \
  > "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
cd "$ROOT"

# ── Start AI Service ──────────────────────────────────────────────────────
info "Starting AI Service on port 8001..."
cd "$AI"
"$AI/venv/bin/uvicorn" main:app \
  --host 0.0.0.0 --port 8001 \
  > "$AI_LOG" 2>&1 &
AI_PID=$!
cd "$ROOT"

# ── Start Next.js Frontend ────────────────────────────────────────────────
info "Starting Next.js Frontend on port 3000..."
cd "$FRONTEND"
npm run dev \
  > "$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!
cd "$ROOT"

# ── Wait for services to be ready ─────────────────────────────────────────
info "Waiting for services to start..."

wait_for() {
  local NAME="$1" URL="$2" TIMEOUT=60 i=0
  while [ $i -lt $TIMEOUT ]; do
    if curl -sf "$URL" -o /dev/null 2>/dev/null; then
      return 0
    fi
    sleep 1; i=$((i+1))
  done
  return 1
}

if wait_for "Backend" "http://localhost:8000/health"; then
  success "Backend    ✓  http://localhost:8000  (docs: http://localhost:8000/docs)"
else
  error   "Backend    ✗  failed to start — check $BACKEND_LOG"
fi

if wait_for "AI Service" "http://localhost:8001/health"; then
  success "AI Service ✓  http://localhost:8001  (docs: http://localhost:8001/docs)"
else
  error   "AI Service ✗  failed to start — check $AI_LOG"
fi

if wait_for "Frontend" "http://localhost:3000"; then
  success "Frontend   ✓  http://localhost:3000"
else
  warn    "Frontend   — still compiling (Next.js first build takes ~30s)"
fi

# ── Summary ───────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}  All services started!${RESET}"
echo ""
echo -e "  ${BOLD}Open in browser:${RESET}  http://localhost:3000"
echo ""
echo -e "  Service URLs:"
echo -e "    Frontend   → http://localhost:3000"
echo -e "    Backend    → http://localhost:8000   (API docs: /docs)"
echo -e "    AI Service → http://localhost:8001   (API docs: /docs)"
echo ""
echo -e "  PIDs — Backend: $BACKEND_PID | AI: $AI_PID | Frontend: $FRONTEND_PID"
echo -e "  Logs:"
echo -e "    $BACKEND_LOG"
echo -e "    $AI_LOG"
echo -e "    $FRONTEND_LOG"
echo ""
echo -e "  ${YELLOW}To stop all services:${RESET}  bash $ROOT/stop.sh"
echo ""

# Save PIDs for stop script
echo "$BACKEND_PID $AI_PID $FRONTEND_PID" > /tmp/vakilai.pids

# ── Tail logs (Ctrl+C to detach, services keep running) ──────────────────
echo -e "${CYAN}--- Live logs (Ctrl+C to detach, services keep running) ---${RESET}"
tail -f "$BACKEND_LOG" "$AI_LOG" "$FRONTEND_LOG"
