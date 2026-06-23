#!/bin/sh
set -e

# ── ClamAV daemon ──────────────────────────────────────────────────────────────
if command -v clamd >/dev/null 2>&1; then
    # Update signatures at startup (blocking — ensures definitions are current)
    echo "[entrypoint] Updating ClamAV signatures..."
    freshclam --quiet 2>/dev/null || true

    # Start the daemon
    clamd 2>/dev/null || true
    echo "[entrypoint] ClamAV daemon started"

    # Schedule background signature refresh every 6 hours via crond
    if command -v crond >/dev/null 2>&1; then
        echo "0 */6 * * * freshclam --quiet 2>/dev/null || true" | crontab -
        crond 2>/dev/null || true
        echo "[entrypoint] Scheduled freshclam refresh every 6 hours"
    else
        # Fallback: background loop every 6 hours (no crond available)
        (
            while true; do
                sleep 21600
                freshclam --quiet 2>/dev/null || true
                echo "[entrypoint] ClamAV signatures refreshed"
            done
        ) &
        echo "[entrypoint] Background freshclam refresh scheduled (no crond)"
    fi
else
    echo "[entrypoint] WARNING: ClamAV not installed — using pattern-based fallback scanner"
fi

# Switch to non-root user and exec the application
exec su-exec appuser "$@" 2>/dev/null || exec "$@"
