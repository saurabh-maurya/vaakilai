#!/bin/bash

# VakilAI — One-time Setup Script
# Run this once before using start.sh
# Usage: bash setup.sh

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
AI="$ROOT/ai_service"
FRONTEND="$ROOT/frontend"

# ── Colors ────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[setup]${RESET} $1"; }
success() { echo -e "${GREEN}[setup]${RESET} $1"; }
warn()    { echo -e "${YELLOW}[setup]${RESET} $1"; }
error()   { echo -e "${RED}[setup]${RESET} $1"; exit 1; }
step()    { echo -e "\n${BOLD}${CYAN}━━━ $1 ━━━${RESET}"; }

# ── Banner ─────────────────────────────────────────────────────────────────
echo -e "${BOLD}${CYAN}"
echo "  ╔══════════════════════════════════════╗"
echo "  ║          VakilAI Platform            ║"
echo "  ║       First-time Setup Script        ║"
echo "  ╚══════════════════════════════════════╝"
echo -e "${RESET}"

# ── 1. Check system prerequisites ─────────────────────────────────────────
step "1/6  Checking prerequisites"

check_cmd() {
  if command -v "$1" &>/dev/null; then
    success "$1 found: $(command -v "$1")"
  else
    error "$1 not found. Please install it and re-run setup."
  fi
}

check_cmd python3
check_cmd pip3
check_cmd curl

# ── Node.js version check (Next.js 14 requires >= 18) ─────────────────────
if command -v node &>/dev/null; then
  NODE_VER=$(node --version | sed 's/v//')
  NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
  if [ "$NODE_MAJOR" -lt 18 ]; then
    warn "Node.js $NODE_VER detected — Next.js 14 requires v18+."
    if [ -s "$HOME/.nvm/nvm.sh" ]; then
      # shellcheck source=/dev/null
      source "$HOME/.nvm/nvm.sh"
      if nvm ls 20 &>/dev/null; then
        info "Switching to Node 20 via nvm..."
        nvm use 20
      elif nvm ls 18 &>/dev/null; then
        info "Switching to Node 18 via nvm..."
        nvm use 18
      else
        info "Installing Node 20 via nvm (this may take a moment)..."
        nvm install 20
        nvm use 20
      fi
      # Persist the switch for this session
      export PATH="$HOME/.nvm/versions/node/$(node --version | sed 's/v//')/bin:$PATH"
      success "Node $(node --version) active"
    else
      error "Node.js $NODE_VER is too old and nvm is not available.\nInstall Node 20: https://nodejs.org"
    fi
  else
    success "node found: v$NODE_VER"
  fi
else
  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    source "$HOME/.nvm/nvm.sh"
    nvm install 20 && nvm use 20
    success "Node $(node --version) installed via nvm"
  else
    error "node not found. Install Node.js 20+: https://nodejs.org"
  fi
fi

check_cmd npm

PYTHON_VER=$(python3 --version | awk '{print $2}')
NODE_VER=$(node --version)
info "Python $PYTHON_VER | Node $NODE_VER"

# ── 2. Environment file ────────────────────────────────────────────────────
step "2/6  Environment configuration"

if [ ! -f "$ROOT/.env" ]; then
  if [ -f "$ROOT/.env.example" ]; then
    cp "$ROOT/.env.example" "$ROOT/.env"
    warn ".env created from .env.example"
    warn "IMPORTANT: Edit $ROOT/.env and add your API keys before starting:"
    warn "  - ANTHROPIC_API_KEY  (required for AI features)"
    warn "  - JWT_SECRET         (required — change from default)"
    warn "  - MONGODB_URL        (default: mongodb://localhost:27017)"
  else
    cat > "$ROOT/.env" << 'EOF'
# VakilAI — Environment Variables
# Edit this file before running start.sh

# MongoDB
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=vakilai

# JWT (CHANGE THIS in production)
JWT_SECRET=vakilai-dev-secret-change-in-prod
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440

# Anthropic (REQUIRED for AI features)
ANTHROPIC_API_KEY=

# Pinecone (optional — AI search falls back to LLM without it)
PINECONE_API_KEY=
PINECONE_INDEX_NAME=vakilai-judgments

# AWS S3 (optional — for document storage)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-south-1
S3_BUCKET_DOCUMENTS=vakilai-documents

# Razorpay (optional — for payments)
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=

# CORS
CORS_ORIGINS=http://localhost:3000

# App
APP_ENV=development
DEBUG=true
EOF
    warn ".env created with defaults. Edit it and add your ANTHROPIC_API_KEY."
  fi
else
  success ".env already exists"
fi

# Check ANTHROPIC_API_KEY is set
if grep -qE '^ANTHROPIC_API_KEY=$' "$ROOT/.env" 2>/dev/null; then
  warn "ANTHROPIC_API_KEY is empty in .env — AI features will not work until you add it."
fi

# Copy .env to each service
cp "$ROOT/.env" "$BACKEND/.env"
cp "$ROOT/.env" "$AI/.env"
success ".env copied to backend/ and ai_service/"

# ── 3. Frontend environment ────────────────────────────────────────────────
if [ ! -f "$FRONTEND/.env.local" ]; then
  cp "$FRONTEND/.env.local.example" "$FRONTEND/.env.local" 2>/dev/null || cat > "$FRONTEND/.env.local" << 'EOF'
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_AI_URL=http://localhost:8001
NEXT_PUBLIC_APP_NAME=VakilAI
EOF
  success "frontend/.env.local created"
else
  success "frontend/.env.local already exists"
fi

# ── 4. Backend Python virtualenv ───────────────────────────────────────────
step "3/6  Backend — Python dependencies"

if [ ! -f "$BACKEND/venv/bin/python" ]; then
  info "Creating virtualenv for backend..."
  python3 -m venv "$BACKEND/venv"
fi

info "Installing backend dependencies..."
"$BACKEND/venv/bin/pip" install -r "$BACKEND/requirements.txt" -q --disable-pip-version-check
success "Backend dependencies installed"

# ── 5. AI Service Python virtualenv ───────────────────────────────────────
step "4/6  AI Service — Python dependencies"

if [ ! -f "$AI/venv/bin/python" ]; then
  info "Creating virtualenv for ai_service..."
  python3 -m venv "$AI/venv"
fi

info "Installing AI service dependencies (LangGraph, Anthropic SDK)..."
"$AI/venv/bin/pip" install -r "$AI/requirements.txt" -q --disable-pip-version-check
success "AI service dependencies installed"

# ── 6. Frontend Node dependencies ─────────────────────────────────────────
step "5/6  Frontend — Node.js dependencies"

cd "$FRONTEND"
info "Running npm install..."
npm install --silent
success "Frontend dependencies installed"
cd "$ROOT"

# ── 7. Verify MongoDB connectivity ────────────────────────────────────────
step "6/6  Checking MongoDB"

MONGO_URL=$(grep -E '^MONGODB_URL=' "$ROOT/.env" | cut -d= -f2-)
MONGO_URL="${MONGO_URL:-mongodb://localhost:27017}"

if mongosh "$MONGO_URL" --eval "db.runCommand({ping:1})" --quiet &>/dev/null 2>&1; then
  success "MongoDB reachable at $MONGO_URL"
elif mongo "$MONGO_URL" --eval "db.runCommand({ping:1})" --quiet &>/dev/null 2>&1; then
  success "MongoDB reachable at $MONGO_URL"
else
  warn "MongoDB not reachable at $MONGO_URL"
  warn "Start MongoDB before running start.sh:"
  warn "  macOS (brew):  brew services start mongodb-community"
  warn "  Docker:        docker run -d -p 27017:27017 mongo:7"
fi

# ── Done ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}  Setup complete!${RESET}"
echo ""
echo -e "  ${BOLD}Next steps:${RESET}"
echo ""

# Check if API key is missing
if grep -qE '^ANTHROPIC_API_KEY=$' "$ROOT/.env" 2>/dev/null; then
  echo -e "  ${YELLOW}1. Add your Anthropic API key to .env:${RESET}"
  echo -e "     ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxx"
  echo ""
fi

echo -e "  Start all services:"
echo -e "    ${BOLD}bash $ROOT/start.sh${RESET}"
echo ""
echo -e "  Open in browser:"
echo -e "    http://localhost:3000"
echo ""
echo -e "  Stop all services:"
echo -e "    ${BOLD}bash $ROOT/stop.sh${RESET}"
echo ""
