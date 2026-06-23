#!/usr/bin/env bash
# Re-exec under bash if called with sh/dash (nvm and echo -e require bash)
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi
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

# ── Preflight: disk space check ───────────────────────────────────────────────
# Minimum free space required (in MB):
#   ~800 MB  Python deps (backend + ai_service)
#   ~400 MB  Node.js + npm packages
#   ~500 MB  pip/npm temp/build files
#   ~300 MB  headroom
REQUIRED_MB=2048

_free_mb() {
  # Returns free MB on the filesystem containing $1 (defaults to current dir)
  local target="${1:-.}"
  df -BM "$target" 2>/dev/null | awk 'NR==2 {gsub(/M/,"",$4); print $4}' || echo 0
}

_free_home_mb() { _free_mb "$HOME"; }
_free_root_mb() { _free_mb "$ROOT"; }

FREE_ROOT="$(_free_root_mb)"
FREE_HOME="$(_free_home_mb)"
FREE_TMP="$(_free_mb /tmp)"

# Warn early if /tmp (tmpfs) is critically low — pip Rust builds need 300-500 MB
# of temp space; this check runs BEFORE we redirect TMPDIR below.
if [ "${FREE_TMP:-0}" -lt 200 ] 2>/dev/null; then
  warn "/tmp only has ${FREE_TMP} MB free — clearing to avoid build failures"
  # Safe to remove pip/npm debris in /tmp; nothing persistent lives here
  rm -rf /tmp/pip-* /tmp/npm-* /tmp/rust* 2>/dev/null || true
fi

if [ "${FREE_ROOT:-0}" -lt "$REQUIRED_MB" ] 2>/dev/null; then
  echo ""
  echo -e "${RED}╔══════════════════════════════════════════════════════════════╗"
  echo -e "║  DISK SPACE TOO LOW — setup cannot continue safely           ║"
  echo -e "╚══════════════════════════════════════════════════════════════╝${RESET}"
  echo ""
  echo -e "  Free on $ROOT : ${RED}${FREE_ROOT} MB${RESET}  (need at least ${REQUIRED_MB} MB)"
  echo ""
  echo -e "  ${BOLD}Free up space first:${RESET}"
  echo -e "    # Remove node_modules (reinstalled by this script)"
  echo -e "    rm -rf $FRONTEND/node_modules"
  echo -e ""
  echo -e "    # Remove Python venvs (recreated by this script)"
  echo -e "    rm -rf $BACKEND/venv $AI/venv"
  echo -e ""
  echo -e "    # Clear pip cache"
  echo -e "    rm -rf ~/.cache/pip"
  echo -e ""
  echo -e "    # Clear npm cache"
  echo -e "    npm cache clean --force 2>/dev/null || true"
  echo -e ""
  echo -e "    # Remove old apt packages"
  echo -e "    sudo apt-get autoremove -y && sudo apt-get clean"
  echo -e ""
  echo -e "    # Check what's eating space"
  echo -e "    du -sh /* 2>/dev/null | sort -h | tail -20"
  echo -e ""
  echo -e "  ${BOLD}Or expand your EBS volume in the AWS console, then:${RESET}"
  echo -e "    sudo growpart /dev/xvda 1 && sudo resize2fs /dev/xvda1"
  echo -e "    # (adjust device name — check with: lsblk)"
  echo ""
  exit 1
fi

# Auto-clean when space is low (< 512 MB on HOME) — node_modules + caches can
# free several hundred MB; everything is recreated by subsequent steps.
if [ "${FREE_HOME:-0}" -lt 512 ] 2>/dev/null; then
  warn "Low space on HOME ($HOME): ${FREE_HOME} MB free — auto-cleaning to avoid build failures"
  [ -d "$FRONTEND/node_modules" ] && { info "Removing $FRONTEND/node_modules ..."; rm -rf "$FRONTEND/node_modules"; }
  [ -d "$BACKEND/venv" ]          && { info "Removing $BACKEND/venv ...";          rm -rf "$BACKEND/venv"; }
  [ -d "$AI/venv" ]               && { info "Removing $AI/venv ...";               rm -rf "$AI/venv"; }
  rm -rf ~/.cache/pip 2>/dev/null || true
  npm cache clean --force 2>/dev/null || true
fi

# ── Redirect pip build/temp dirs off tmpfs ────────────────────────────────────
# /tmp is a tmpfs (RAM-backed) — typically 256-512 MB. Packages like
# pydantic-core compile from source via Rust/maturin on Python 3.14+ and need
# several hundred MB of build temp space, exhausting the small tmpfs quota.
# Redirect TMPDIR and pip's build dir to the main filesystem instead.
PIP_TMP="$ROOT/.pip-tmp"
mkdir -p "$PIP_TMP"
export TMPDIR="$PIP_TMP"
export PIP_CACHE_DIR="$PIP_TMP/pip-cache"
export PIP_BUILD="$PIP_TMP/pip-build"
info "pip build temp redirected to $PIP_TMP (avoids /tmp quota errors)"

# Ensure cleanup on exit (success or failure)
trap 'rm -rf "$PIP_TMP" 2>/dev/null || true' EXIT

FREE_TMP="$(_free_mb "$PIP_TMP")"
success "Disk space OK — ${FREE_ROOT} MB free on project filesystem  |  ${FREE_TMP} MB free on build temp"

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
# ── Python version selection ──────────────────────────────────────────────────
# Python 3.13+ has no pre-built binary wheels for pydantic-core, Pillow,
# cryptography, argon2-cffi, etc. — pip falls back to Rust/C compilation which
# takes 20-40 min and often OOM-kills on small EC2 instances.
#
# Strategy: prefer Python 3.12 (full wheel support for all our deps), fall
# back to 3.11, then accept 3.13+ only if nothing better is available.
# Install python3.12 via deadsnakes PPA if needed (Ubuntu only).

_py_minor() { "$1" -c "import sys; print(sys.version_info.minor)" 2>/dev/null || echo 0; }
_py_major() { "$1" -c "import sys; print(sys.version_info.major)" 2>/dev/null || echo 0; }

# Score: prefer 3.12 > 3.11 > 3.13 > 3.10 > other
PYTHON_BIN=""
for candidate in python3.12 python3.11 python3.13 python3.10 python3; do
  if command -v "$candidate" &>/dev/null; then
    _maj="$(_py_major "$candidate")"
    _min="$(_py_minor "$candidate")"
    if [ "$_maj" -eq 3 ] && [ "$_min" -ge 10 ]; then
      PYTHON_BIN="$(command -v "$candidate")"
      break
    fi
  fi
done

# If Python 3.12 not found and we're on apt, install it via deadsnakes
if [ -z "$PYTHON_BIN" ] || [ "$(_py_minor "$PYTHON_BIN")" -gt 12 ]; then
  if [ "$PKG_MGR" = "apt" ] && ! command -v python3.12 &>/dev/null; then
    info "Python 3.12 not found — installing via deadsnakes PPA (avoids Rust/C source builds)..."
    sudo apt-get install -y -qq software-properties-common 2>/dev/null || true
    sudo add-apt-repository -y ppa:deadsnakes/ppa 2>/dev/null || true
    sudo apt-get update -qq >/dev/null
    sudo apt-get install -y -qq python3.12 python3.12-venv python3.12-dev 2>/dev/null || true
  fi
  if command -v python3.12 &>/dev/null; then
    PYTHON_BIN="$(command -v python3.12)"
  fi
fi

# Final fallback: use whatever python3 we have
if [ -z "$PYTHON_BIN" ]; then
  PYTHON_BIN="$(command -v python3 || true)"
fi

[ -n "$PYTHON_BIN" ] || error "No Python 3.10+ found. Install python3.12: sudo apt-get install python3.12"

PY_VER_STR="$("$PYTHON_BIN" --version 2>&1 | awk '{print $2}')"
PY_MAJOR="$(_py_major "$PYTHON_BIN")"
PY_MINOR="$(_py_minor "$PYTHON_BIN")"

if [ "$PY_MAJOR" -lt 3 ] || [ "$PY_MINOR" -lt 10 ]; then
  error "Python 3.10+ required. Found: $PY_VER_STR"
fi

if [ "$PY_MINOR" -ge 13 ]; then
  warn "Using Python $PY_VER_STR — pre-built wheels unavailable for some packages"
  warn "Source compilation (Rust/C) will run; this may take 20-40 min on first install"
else
  success "Python $PY_VER_STR — pre-built wheels available for all packages"
fi
success "Using: $PYTHON_BIN"

# ── pip ───────────────────────────────────────────────────────────────────────
pip_available() { "$PYTHON_BIN" -c "import pip" &>/dev/null 2>&1; }

if ! pip_available; then
  info "pip not found — trying ensurepip..."
  "$PYTHON_BIN" -m ensurepip --upgrade 2>/dev/null || true
fi

if ! pip_available && [ "$PKG_MGR" = "apt" ]; then
  info "Installing pip via apt..."
  sudo apt-get install -y -qq "python${PY_MAJOR}.${PY_MINOR}-pip" 2>/dev/null \
    || sudo apt-get install -y -qq python3-pip 2>/dev/null || true
fi

if ! pip_available; then
  info "Bootstrapping pip via get-pip.py..."
  TMP_GETPIP="$(mktemp "$PIP_TMP/get-pip-XXXXXX.py")"
  curl -fsSL "https://bootstrap.pypa.io/get-pip.py" -o "$TMP_GETPIP" 2>/dev/null \
    && "$PYTHON_BIN" "$TMP_GETPIP" --quiet 2>/dev/null || true
  rm -f "$TMP_GETPIP"
fi

pip_available || error "pip could not be installed for $PYTHON_BIN"
success "pip ready for $PYTHON_BIN"

# ── venv ──────────────────────────────────────────────────────────────────────
if ! "$PYTHON_BIN" -c "import venv" &>/dev/null 2>&1; then
  info "python-venv not found — installing..."
  [ "$PKG_MGR" = "apt" ] && \
    sudo apt-get install -y -qq "python${PY_MAJOR}.${PY_MINOR}-venv" 2>/dev/null || true
fi
"$PYTHON_BIN" -c "import venv" &>/dev/null 2>&1 \
  || error "python-venv unavailable for $PYTHON_BIN. Try: sudo apt-get install python3.12-venv"
success "venv available"

# ── curl ──────────────────────────────────────────────────────────────────────
if ! command -v curl &>/dev/null; then
  install_pkg curl
fi
success "curl found: $(command -v curl)"

# ── Build tools & C library headers ──────────────────────────────────────────
# Python 3.13+ has no pre-built wheels for several packages (Pillow, pydantic-
# core, cryptography, argon2-cffi). They compile from source and need these
# system headers/libraries:
#
#   build-essential   gcc, make (required for any C extension)
#   libssl-dev        cryptography, PyJWT
#   libffi-dev        cffi, cryptography
#   libjpeg-dev       Pillow — JPEG support (mandatory)
#   zlib1g-dev        Pillow — PNG/zip; also pydantic-core
#   libpng-dev        Pillow — PNG
#   libwebp-dev       Pillow — WebP
#   libtiff-dev       Pillow — TIFF
#   libfreetype6-dev  Pillow — font rendering
#   libopenjp2-7-dev  Pillow — JPEG 2000
#   pkg-config        lets pip find the above libs via pkg-config
#   rust/cargo        pydantic-core compiles via maturin (Rust)
if [ "$PKG_MGR" = "apt" ]; then
  BUILD_PKGS=(
    build-essential pkg-config
    libssl-dev libffi-dev
    libjpeg-dev zlib1g-dev libpng-dev libwebp-dev
    libtiff-dev libfreetype6-dev libopenjp2-7-dev
  )
  MISSING=()
  for pkg in "${BUILD_PKGS[@]}"; do
    dpkg -s "$pkg" &>/dev/null 2>&1 || MISSING+=("$pkg")
  done
  if [ ${#MISSING[@]} -gt 0 ]; then
    info "Installing build/image libs: ${MISSING[*]}"
    sudo apt-get install -y -qq "${MISSING[@]}" >/dev/null
  fi
  success "Build tools & image libraries present"
fi

# ── Rust toolchain (needed by pydantic-core / maturin on Python 3.13+) ────────
# Only install if cargo is missing — rustup installs to ~/.cargo and is fast.
if ! command -v cargo &>/dev/null; then
  info "Rust not found — installing via rustup (needed to build pydantic-core)..."
  curl -fsSL https://sh.rustup.rs | sh -s -- -y --profile minimal --quiet
  # shellcheck source=/dev/null
  source "$HOME/.cargo/env" 2>/dev/null || export PATH="$HOME/.cargo/bin:$PATH"
  success "Rust $(rustc --version 2>/dev/null || echo '(installed)') ready"
else
  # Ensure cargo is on PATH for the rest of the script
  [ -f "$HOME/.cargo/env" ] && source "$HOME/.cargo/env" 2>/dev/null || true
  success "Rust already installed: $(rustc --version 2>/dev/null)"
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

  # nvm's PATH changes via shell functions don't always propagate in
  # non-interactive bash. Use find to locate the installed node bin dir
  # and prepend it to PATH explicitly.
  _node_dir="$(find "$NVM_DIR/versions/node" -maxdepth 1 \
               -name "v${NODE_REQUIRED}*" -type d 2>/dev/null \
               | sort -V | tail -1 || true)"
  if [ -n "$_node_dir" ] && [ -x "$_node_dir/bin/node" ]; then
    export PATH="$_node_dir/bin:$PATH"
    hash -r 2>/dev/null || true   # clear bash's command-lookup cache
  else
    warn "Could not locate node bin dir under $NVM_DIR/versions/node — PATH may be incomplete"
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
  info "Creating backend virtualenv ($("$PYTHON_BIN" --version)) at $BACKEND_VENV ..."
  "$PYTHON_BIN" -m venv "$BACKEND_VENV"
fi

info "Installing backend pip dependencies..."
[ "$PY_MINOR" -ge 13 ] && info "(Source compilation required on Python 3.1${PY_MINOR} — may take 20-40 min)"
"$BACKEND_VENV/bin/pip" install --upgrade pip --no-cache-dir --disable-pip-version-check
if ! "$BACKEND_VENV/bin/pip" install -r "$BACKEND/requirements.txt" \
     --no-cache-dir --disable-pip-version-check; then
  error "Backend pip install failed (check disk space: df -h)"
fi
success "Backend Python dependencies installed"

# ── 5. AI Service Python venv ─────────────────────────────────────────────────
step "5/7  AI Service — Python dependencies"

AI_VENV="$AI/venv"
if [ ! -f "$AI_VENV/bin/python" ]; then
  info "Creating ai_service virtualenv ($("$PYTHON_BIN" --version)) at $AI_VENV ..."
  "$PYTHON_BIN" -m venv "$AI_VENV"
fi

info "Installing AI service pip dependencies (LangGraph, Anthropic SDK)..."
[ "$PY_MINOR" -ge 13 ] && info "(Source compilation required on Python 3.1${PY_MINOR} — may take 20-40 min)"
"$AI_VENV/bin/pip" install --upgrade pip --no-cache-dir --disable-pip-version-check
if ! "$AI_VENV/bin/pip" install -r "$AI/requirements.txt" \
     --no-cache-dir --disable-pip-version-check; then
  error "AI service pip install failed (check disk space: df -h)"
fi
success "AI service Python dependencies installed"

# ── 6. Frontend npm install ────────────────────────────────────────────────────
step "6/7  Frontend — Node.js dependencies"

cd "$FRONTEND"
# Remove stale node_modules that cause ENOTEMPTY rename errors on re-runs
if [ -d node_modules ]; then
  info "Removing stale node_modules before fresh install..."
  rm -rf node_modules
fi
rm -f package-lock.json
info "Running npm install..."
if ! npm install; then
  error "npm install failed (check disk space: df -h)"
fi
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
