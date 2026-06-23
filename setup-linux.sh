#!/usr/bin/env bash
# =============================================================================
# VakilAI — Linux Setup Script  (Amazon EC2 Ubuntu / Ubuntu 22.04+)
# =============================================================================
# Usage:
#   chmod +x setup-linux.sh
#   bash setup-linux.sh
#
# What it does:
#   1. Detects package manager (apt / yum / dnf) and installs system deps
#   2. Ensures Python 3.10+, pip3, python3-venv are available
#   3. Installs Node.js 20 via nvm (installs nvm first if needed)
#   4. Copies .env files
#   5. Creates Python virtualenvs and installs pip dependencies
#   6. Installs frontend npm dependencies
#   7. Verifies MongoDB connectivity
# =============================================================================

set -uo pipefail   # -u: unbound vars are errors; -o pipefail: pipe errors propagate
                   # NOTE: intentionally NO -e so we can handle failures ourselves

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
AI="$ROOT/ai_service"
FRONTEND="$ROOT/frontend"

NVM_VERSION="v0.39.7"
NODE_REQUIRED=20

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[setup]${RESET} $*"; }
success() { echo -e "${GREEN}[setup]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[setup]${RESET} $*"; }
error()   { echo -e "${RED}[setup] ERROR:${RESET} $*"; exit 1; }
step()    { echo -e "\n${BOLD}${CYAN}━━━ $* ━━━${RESET}"; }

# ── Banner ─────────────────────────────────────────────────────────────────────
echo -e "${BOLD}${CYAN}"
echo "  ╔══════════════════════════════════════╗"
echo "  ║          VakilAI Platform            ║"
echo "  ║     Linux / Amazon EC2 Setup         ║"
echo "  ╚══════════════════════════════════════╝"
echo -e "${RESET}"

# ── Detect package manager ─────────────────────────────────────────────────────
step "1/7  System packages"

PKG_MGR=""
if command -v apt-get &>/dev/null; then
  PKG_MGR="apt"
elif command -v dnf &>/dev/null; then
  PKG_MGR="dnf"
elif command -v yum &>/dev/null; then
  PKG_MGR="yum"
fi

install_pkg() {
  # $1 = package name, $2 = optional apt alias
  local pkg="${2:-$1}"
  info "Installing $1 ..."
  case "$PKG_MGR" in
    apt)
      sudo apt-get install -y -qq "$pkg" >/dev/null
      ;;
    dnf)
      sudo dnf install -y -q "$1" >/dev/null
      ;;
    yum)
      sudo yum install -y -q "$1" >/dev/null
      ;;
    *)
      warn "No recognised package manager found — please install $1 manually."
      ;;
  esac
}

# Update apt package index once (quietly)
if [ "$PKG_MGR" = "apt" ]; then
  info "Updating apt package index..."
  sudo apt-get update -qq >/dev/null
fi

# ── Python 3 ──────────────────────────────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
  install_pkg python3
fi
PYTHON_BIN="$(command -v python3)"
success "python3 found: $PYTHON_BIN"

# Verify Python >= 3.10
PY_MINOR=$(python3 -c "import sys; print(sys.version_info.minor)")
PY_MAJOR=$(python3 -c "import sys; print(sys.version_info.major)")
if [ "$PY_MAJOR" -lt 3 ] || { [ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 10 ]; }; then
  error "Python 3.10+ is required. Found: $(python3 --version). Install a newer Python."
fi
success "Python $(python3 --version | awk '{print $2}') OK"

# ── pip3 ──────────────────────────────────────────────────────────────────────
# Use `python3 -c "import pip"` to detect pip — this checks the module is
# importable regardless of exit code, which changed in Python 3.14 / pip 25.x
# where `python3 -m pip --version` may exit non-zero even when pip is present.
#
# Install order:
#   1. ensurepip  — stdlib, works for any CPython version (no network needed)
#   2. apt/dnf/yum python3-pip
#   3. get-pip.py bootstrap from pypa.io (always works as last resort)

pip_available() {
  python3 -c "import pip" &>/dev/null 2>&1
}

if ! pip_available; then
  info "pip not found — trying ensurepip (built-in)..."
  python3 -m ensurepip --upgrade 2>/dev/null || true
fi

if ! pip_available; then
  info "ensurepip did not install pip — trying package manager..."
  case "$PKG_MGR" in
    apt)
      PY_VER="$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
      sudo apt-get install -y -qq "python${PY_VER}-pip" 2>/dev/null \
        || sudo apt-get install -y -qq python3-pip 2>/dev/null \
        || true
      ;;
    dnf) sudo dnf install -y -q python3-pip 2>/dev/null || true ;;
    yum) sudo yum install -y -q python3-pip 2>/dev/null || true ;;
  esac
fi

if ! pip_available; then
  info "Package manager install failed — bootstrapping via get-pip.py..."
  TMP_GETPIP="$(mktemp /tmp/get-pip-XXXXXX.py)"
  if curl -fsSL "https://bootstrap.pypa.io/get-pip.py" -o "$TMP_GETPIP" 2>/dev/null; then
    python3 "$TMP_GETPIP" --quiet 2>/dev/null || true
  fi
  rm -f "$TMP_GETPIP"
fi

if ! pip_available; then
  error "pip could not be installed. Try manually:\n  python3 -m ensurepip --upgrade\n  or: curl -fsSL https://bootstrap.pypa.io/get-pip.py | python3 -"
fi
PIP_VER="$(python3 -m pip --version 2>/dev/null | awk '{print $1,$2}' || echo "pip (version unknown)")"
success "pip found — $PIP_VER"

# ── python3-venv ──────────────────────────────────────────────────────────────
# Use module import check — `python3 -m venv --help` can exit non-zero on
# Python 3.14 even when venv is available.
if ! python3 -c "import venv" &>/dev/null 2>&1; then
  info "python3-venv not found — installing..."
  case "$PKG_MGR" in
    apt)
      PY_VER="$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
      sudo apt-get install -y -qq "python${PY_VER}-venv" 2>/dev/null \
        || sudo apt-get install -y -qq python3-venv python3-dev 2>/dev/null \
        || true
      ;;
    dnf) sudo dnf install -y -q python3-devel 2>/dev/null || true ;;
    yum) sudo yum install -y -q python3-devel 2>/dev/null || true ;;
  esac
fi
python3 -c "import venv" &>/dev/null 2>&1 || error "python3-venv unavailable. Try: sudo apt-get install -y python3.14-venv"
success "python3-venv available"

# ── curl ──────────────────────────────────────────────────────────────────────
if ! command -v curl &>/dev/null; then
  install_pkg curl
fi
success "curl found: $(command -v curl)"

# ── Build tools (needed for some pip packages: cryptography, argon2-cffi) ─────
if [ "$PKG_MGR" = "apt" ]; then
  for pkg in build-essential libssl-dev libffi-dev; do
    if ! dpkg -s "$pkg" &>/dev/null 2>&1; then
      info "Installing build dep: $pkg"
      sudo apt-get install -y -qq "$pkg" >/dev/null
    fi
  done
  success "Build tools present"
fi

# ── Node.js 20 via nvm ────────────────────────────────────────────────────────
step "2/7  Node.js"

NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

# Load nvm if already installed
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck source=/dev/null
  source "$NVM_DIR/nvm.sh"
fi

# Check current node version (without failing if not installed)
NODE_MAJOR=0
if command -v node &>/dev/null; then
  _raw_ver="$(node --version 2>/dev/null || true)"
  # Strip leading 'v' and extract major — handle empty or malformed strings
  _stripped="${_raw_ver#v}"
  _major_candidate="${_stripped%%.*}"
  if [[ "$_major_candidate" =~ ^[0-9]+$ ]]; then
    NODE_MAJOR="$_major_candidate"
  fi
fi

if [ "$NODE_MAJOR" -ge "$NODE_REQUIRED" ]; then
  success "node found: $(node --version)  (>= v${NODE_REQUIRED} required)"
else
  if [ "$NODE_MAJOR" -gt 0 ]; then
    warn "Node.js v${NODE_MAJOR} is too old — Node ${NODE_REQUIRED}+ required."
  else
    info "Node.js not found — installing via nvm..."
  fi

  # Install nvm if not present
  if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    info "Installing nvm ${NVM_VERSION}..."
    curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" | bash
    # shellcheck source=/dev/null
    export NVM_DIR="$HOME/.nvm"
    source "$NVM_DIR/nvm.sh"
    success "nvm ${NVM_VERSION} installed"
  else
    source "$NVM_DIR/nvm.sh"
  fi

  # Install Node 20 LTS
  info "Installing Node.js ${NODE_REQUIRED} LTS via nvm..."
  nvm install "$NODE_REQUIRED" >/dev/null
  nvm alias default "$NODE_REQUIRED"
  nvm use "$NODE_REQUIRED"

  # nvm use updates PATH via shell functions, but those don't always propagate
  # in non-interactive scripts. Explicitly find and prepend the node bin dir.
  _node_bin="$(nvm which "$NODE_REQUIRED" 2>/dev/null || true)"
  if [ -z "$_node_bin" ]; then
    # Fallback: find the highest-versioned v20.x directory nvm created
    _node_bin="$(ls -d "$NVM_DIR/versions/node/v${NODE_REQUIRED}"*/bin/node 2>/dev/null \
                 | sort -V | tail -1 || true)"
  fi
  if [ -n "$_node_bin" ] && [ -f "$_node_bin" ]; then
    export PATH="$(dirname "$_node_bin"):$PATH"
  fi

  # Add nvm to shell rc files so it persists after reboot
  for RC in "$HOME/.bashrc" "$HOME/.bash_profile" "$HOME/.profile"; do
    if [ -f "$RC" ] && ! grep -q 'NVM_DIR' "$RC"; then
      {
        echo ''
        echo '# nvm — Node Version Manager'
        echo "export NVM_DIR=\"\$HOME/.nvm\""
        echo '[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"'
        echo '[ -s "$NVM_DIR/bash_completion" ] && source "$NVM_DIR/bash_completion"'
      } >> "$RC"
      info "nvm init added to $RC"
    fi
  done

  success "Node.js $(node --version) installed via nvm"
fi

# Ensure npm is available
if ! command -v npm &>/dev/null; then
  error "npm not found after Node.js install. Re-run this script or install manually."
fi
success "npm found: $(npm --version)"

# ── 3. Environment files ───────────────────────────────────────────────────────
step "3/7  Environment configuration"

# Root .env
if [ ! -f "$ROOT/.env" ]; then
  if [ -f "$ROOT/.env.example" ]; then
    cp "$ROOT/.env.example" "$ROOT/.env"
    warn ".env created from .env.example"
  else
    cat > "$ROOT/.env" <<'ENVEOF'
# VakilAI — generated by setup-linux.sh
# Fill in your API keys before starting services.

MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=vakilai

JWT_SECRET=CHANGE_ME_at_least_32_random_chars
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60

ANTHROPIC_API_KEY=
PINECONE_API_KEY=

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-south-1
S3_BUCKET_DOCUMENTS=vakilai-documents
S3_BUCKET_INVOICES=vakilai-invoices

RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=

INTERNAL_SERVICE_KEY=CHANGE_ME_at_least_32_chars
CONFIG_ENCRYPTION_KEY=CHANGE_ME_at_least_32_chars
REDIS_URL=
METRICS_TOKEN=
SENTRY_DSN=

APP_ENV=development
DEBUG=false
CORS_ORIGINS=http://localhost:3000
ENVEOF
    warn ".env created with defaults — edit it and add your ANTHROPIC_API_KEY."
  fi
else
  success ".env already exists"
fi

# Warn if critical keys are still placeholder
for KEY in JWT_SECRET INTERNAL_SERVICE_KEY CONFIG_ENCRYPTION_KEY ANTHROPIC_API_KEY; do
  VAL="$(grep -E "^${KEY}=" "$ROOT/.env" 2>/dev/null | cut -d= -f2- | tr -d '"' | xargs)"
  if [ -z "$VAL" ] || [[ "$VAL" == CHANGE_ME* ]] || [[ "$VAL" == "your-"* ]] || [[ "$VAL" == "sk-ant-your"* ]]; then
    warn "${KEY} is not set or is a placeholder in .env"
  fi
done

# Propagate root .env to services (create if missing; never overwrite)
for TARGET in "$BACKEND/.env" "$AI/.env"; do
  if [ ! -f "$TARGET" ]; then
    cp "$ROOT/.env" "$TARGET"
    success "Copied root .env → $TARGET"
  else
    success "$TARGET already exists (not overwritten)"
  fi
done

# Frontend .env.local
if [ ! -f "$FRONTEND/.env.local" ]; then
  if [ -f "$FRONTEND/.env.local.example" ]; then
    cp "$FRONTEND/.env.local.example" "$FRONTEND/.env.local"
    success "frontend/.env.local created from example"
  else
    cat > "$FRONTEND/.env.local" <<'FRONTENV'
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_AI_URL=http://localhost:8001
NEXT_PUBLIC_APP_NAME=VakilAI
NEXT_PUBLIC_RAZORPAY_KEY_ID=
FRONTENV
    success "frontend/.env.local created with defaults"
  fi
else
  success "frontend/.env.local already exists"
fi

# ── 4. Backend Python venv ─────────────────────────────────────────────────────
step "4/7  Backend — Python dependencies"

BACKEND_VENV="$BACKEND/venv"
if [ ! -f "$BACKEND_VENV/bin/python" ]; then
  info "Creating backend virtualenv at $BACKEND_VENV ..."
  python3 -m venv "$BACKEND_VENV"
fi

info "Installing backend pip dependencies (this may take a few minutes)..."
"$BACKEND_VENV/bin/pip" install --upgrade pip -q --disable-pip-version-check
"$BACKEND_VENV/bin/pip" install -r "$BACKEND/requirements.txt" -q --disable-pip-version-check
success "Backend Python dependencies installed"

# ── 5. AI Service Python venv ─────────────────────────────────────────────────
step "5/7  AI Service — Python dependencies"

AI_VENV="$AI/venv"
if [ ! -f "$AI_VENV/bin/python" ]; then
  info "Creating ai_service virtualenv at $AI_VENV ..."
  python3 -m venv "$AI_VENV"
fi

info "Installing AI service pip dependencies (LangGraph, Anthropic SDK — may take a few minutes)..."
"$AI_VENV/bin/pip" install --upgrade pip -q --disable-pip-version-check
"$AI_VENV/bin/pip" install -r "$AI/requirements.txt" -q --disable-pip-version-check
success "AI service Python dependencies installed"

# ── 6. Frontend npm install ────────────────────────────────────────────────────
step "6/7  Frontend — Node.js dependencies"

cd "$FRONTEND"
info "Running npm install..."
npm install --prefer-offline 2>/dev/null || npm install
success "Frontend Node.js dependencies installed"
cd "$ROOT"

# ── 7. MongoDB connectivity check ─────────────────────────────────────────────
step "7/7  MongoDB check"

MONGO_URL="$(grep -E '^MONGODB_URL=' "$ROOT/.env" 2>/dev/null | cut -d= -f2- | xargs)"
MONGO_URL="${MONGO_URL:-mongodb://localhost:27017}"

MONGO_OK=false
if command -v mongosh &>/dev/null; then
  if mongosh "$MONGO_URL" --eval "db.runCommand({ping:1})" --quiet &>/dev/null 2>&1; then
    MONGO_OK=true
  fi
elif command -v mongo &>/dev/null; then
  if mongo "$MONGO_URL" --eval "db.runCommand({ping:1})" --quiet &>/dev/null 2>&1; then
    MONGO_OK=true
  fi
fi

if $MONGO_OK; then
  success "MongoDB reachable at $MONGO_URL"
else
  warn "MongoDB not reachable at $MONGO_URL"
  echo ""
  echo -e "  Start MongoDB on Ubuntu:"
  echo -e "    ${BOLD}sudo systemctl start mongod${RESET}          # if installed via apt"
  echo -e "    ${BOLD}docker run -d -p 27017:27017 mongo:7${RESET}  # or via Docker"
  echo ""
  echo -e "  Install MongoDB on Ubuntu 22.04:"
  echo -e "    ${BOLD}bash $ROOT/scripts/install-mongodb.sh${RESET}"
fi

# ── Done ───────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════╗"
echo -e "║        Setup complete!               ║"
echo -e "╚══════════════════════════════════════╝${RESET}"
echo ""

# Summary of what needs attention
NEED_ACTION=false

for KEY in JWT_SECRET INTERNAL_SERVICE_KEY CONFIG_ENCRYPTION_KEY; do
  VAL="$(grep -E "^${KEY}=" "$ROOT/.env" 2>/dev/null | cut -d= -f2- | tr -d '"' | xargs)"
  if [ -z "$VAL" ] || [[ "$VAL" == CHANGE_ME* ]]; then
    if ! $NEED_ACTION; then
      echo -e "  ${YELLOW}Action required — edit $ROOT/.env:${RESET}"
      NEED_ACTION=true
    fi
    echo -e "    ${YELLOW}•${RESET} Generate a secret: ${BOLD}python3 -c \"import secrets; print(secrets.token_hex(32))\"${RESET}"
    echo -e "      then set: ${BOLD}${KEY}=<generated value>${RESET}"
  fi
done

ANTHROPIC_VAL="$(grep -E '^ANTHROPIC_API_KEY=' "$ROOT/.env" 2>/dev/null | cut -d= -f2- | tr -d '"' | xargs)"
if [ -z "$ANTHROPIC_VAL" ] || [[ "$ANTHROPIC_VAL" == "sk-ant-your"* ]] || [[ "$ANTHROPIC_VAL" == CHANGE_ME* ]]; then
  if ! $NEED_ACTION; then
    echo -e "  ${YELLOW}Action required — edit $ROOT/.env:${RESET}"
    NEED_ACTION=true
  fi
  echo -e "    ${YELLOW}•${RESET} Add your Anthropic API key: ${BOLD}ANTHROPIC_API_KEY=sk-ant-xxxxxxxx${RESET}"
fi

if $NEED_ACTION; then
  echo ""
fi

echo -e "  ${BOLD}Start all services:${RESET}"
echo -e "    bash $ROOT/start.sh"
echo ""
echo -e "  ${BOLD}Open in browser:${RESET}"
echo -e "    http://localhost:3000"
echo ""
echo -e "  ${BOLD}To reload nvm in your current shell:${RESET}"
echo -e "    source ~/.bashrc"
echo ""
