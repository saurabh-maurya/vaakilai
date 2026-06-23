#!/bin/bash

# VakilAI — Stop Script

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; RESET='\033[0m'

echo -e "${CYAN}[VakilAI]${RESET} Stopping all services..."

# Kill by saved PIDs
if [ -f /tmp/vakilai.pids ]; then
  read -r PIDS < /tmp/vakilai.pids
  for PID in $PIDS; do
    if kill -0 "$PID" 2>/dev/null; then
      kill "$PID" 2>/dev/null && echo -e "${GREEN}[VakilAI]${RESET} Stopped PID $PID"
    fi
  done
  rm -f /tmp/vakilai.pids
fi

# Also clear ports in case of orphaned processes
for PORT in 8000 8001 3000; do
  PIDS=$(lsof -ti:$PORT 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "$PIDS" | xargs kill -9 2>/dev/null || true
    echo -e "${GREEN}[VakilAI]${RESET} Cleared port $PORT"
  fi
done

echo -e "${GREEN}[VakilAI]${RESET} All stopped."
