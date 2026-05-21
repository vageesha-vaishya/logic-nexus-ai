#!/usr/bin/env bash
# dev-tunnel-check — verify the markets-worker tunnel for the Sthira APK.
#
# The Capacitor WebView in the Sthira mobile build fetches the worker at
# http://127.0.0.1:8001. That only resolves on-device when `adb reverse
# tcp:8001 tcp:8001` is active AND the worker is running on the laptop.
# Either falling away silently produces "Network Exception" for every
# worker call and "Couldn't load ..." widgets across the retail screens.
#
# This script re-establishes the tunnel and confirms it end-to-end:
#   1. Worker reachable from laptop
#   2. adb device connected
#   3. adb reverse mapping present (set it if missing)
#   4. Worker reachable from the device shell via the tunnel
#
# Usage:
#   npm run dev:tunnel:check
# or directly:
#   ./scripts/dev-tunnel-check.sh

set -eo pipefail

WORKER_URL="${MARKETS_WORKER_HEALTH_URL:-http://127.0.0.1:8001/health}"
WORKER_PORT="${MARKETS_WORKER_PORT:-8001}"

red()    { printf '\033[31m%s\033[0m\n' "$1"; }
green()  { printf '\033[32m%s\033[0m\n' "$1"; }
yellow() { printf '\033[33m%s\033[0m\n' "$1"; }

# 1. Worker reachable from laptop.
if ! curl -fsS --max-time 2 "$WORKER_URL" > /dev/null 2>&1; then
  red "✗ Worker not reachable at $WORKER_URL"
  yellow "  Start it with: cd services/markets-worker && uv run uvicorn markets_worker.main:create_app --factory --host 0.0.0.0 --port $WORKER_PORT --reload"
  exit 1
fi
green "✓ Worker reachable on laptop: $WORKER_URL"

# 2. adb device connected.
if ! command -v adb > /dev/null 2>&1; then
  red "✗ adb not on PATH"
  exit 1
fi

DEVICE_LINE=$(adb devices | awk 'NR>1 && $2=="device" {print $1; exit}')
if [ -z "$DEVICE_LINE" ]; then
  red "✗ No adb device in 'device' state"
  yellow "  Plug in the phone, enable USB debugging, then re-run."
  adb devices
  exit 1
fi
green "✓ adb device connected: $DEVICE_LINE"

# 3. adb reverse mapping. Re-establish unconditionally — the command is
#    idempotent and the tunnel can silently drop after USB hiccups.
adb -s "$DEVICE_LINE" reverse tcp:$WORKER_PORT tcp:$WORKER_PORT > /dev/null
if adb -s "$DEVICE_LINE" reverse --list | grep -q "tcp:$WORKER_PORT tcp:$WORKER_PORT"; then
  green "✓ adb reverse tcp:$WORKER_PORT -> laptop tcp:$WORKER_PORT"
else
  red "✗ Failed to set adb reverse mapping"
  adb -s "$DEVICE_LINE" reverse --list
  exit 1
fi

# 4. Worker reachable from the device shell. Confirms the tunnel actually
#    delivers traffic, not just that the mapping exists.
DEVICE_HEALTH=$(adb -s "$DEVICE_LINE" shell "curl -fsS --max-time 2 http://127.0.0.1:$WORKER_PORT/health 2>&1 || echo TUNNEL_FAIL")
if echo "$DEVICE_HEALTH" | grep -q 'TUNNEL_FAIL'; then
  red "✗ Device cannot reach worker through tunnel:"
  echo "  $DEVICE_HEALTH"
  exit 1
fi
green "✓ Device reaches worker via tunnel: $DEVICE_HEALTH"

echo
green "All checks passed — Sthira APK should reach the worker."
