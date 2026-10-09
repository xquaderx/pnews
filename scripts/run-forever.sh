#!/usr/bin/env bash
# Permanent free publisher loop for @PolozNewss.
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p data logs
LOG="logs/publish.log"
# Default 2h — keep local forever-loop aligned with paced Actions schedule.
INTERVAL_SEC="${PUBLISH_INTERVAL_SEC:-7200}"

if [[ -f .env.local ]]; then set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi
if [[ -f .env ]]; then set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHANNEL_ID:-}" ]]; then
  echo "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL_ID" | tee -a "$LOG"
  exit 1
fi

echo "=== start $(date -u +%Y-%m-%dT%H:%M:%SZ) interval=${INTERVAL_SEC}s ===" | tee -a "$LOG"

while true; do
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "=== cycle $ts ===" | tee -a "$LOG"
  if npm run publish:once >>"$LOG" 2>&1; then
    echo "ok $ts" | tee -a "$LOG"
  else
    code=$?
    echo "fail $ts exit=$code (will retry)" | tee -a "$LOG"
  fi
  sleep "$INTERVAL_SEC"
done
