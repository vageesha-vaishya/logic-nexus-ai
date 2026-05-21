#!/usr/bin/env bash
# dev-tunnel-check — verify the Sthira APK can reach the markets-worker.
#
# Default path is LAN-IP (phone and laptop on same WiFi, AP isolation
# off, worker bound to 0.0.0.0:8001). Falls back to adb-reverse loopback
# if the LAN route fails — keeps the script useful when off-WiFi or
# tethered. Either way the goal is the same: the on-device fetch URL
# baked by `scripts/mobile-build-markets.sh` actually resolves to the
# running worker before you waste time installing an APK.
#
# Checks:
#   1. Worker reachable from laptop
#   2. adb device connected
#   3a. (preferred) Detect laptop LAN IP and confirm phone can reach it
#   3b. (fallback)  Set adb reverse tcp:8001 and confirm via device shell
#
# Usage:
#   npm run dev:tunnel:check

set -eo pipefail

WORKER_PORT="${MARKETS_WORKER_PORT:-8001}"
WORKER_HEALTH_LOCAL="http://127.0.0.1:${WORKER_PORT}/health"

red()    { printf '\033[31m%s\033[0m\n' "$1"; }
green()  { printf '\033[32m%s\033[0m\n' "$1"; }
yellow() { printf '\033[33m%s\033[0m\n' "$1"; }

detect_lan_ip() {
  local ip
  for iface in en0 en1; do
    ip=$(ipconfig getifaddr "$iface" 2>/dev/null || true)
    if [ -n "$ip" ]; then echo "$ip"; return 0; fi
  done
  ifconfig 2>/dev/null \
    | awk '/^[a-z]/{iface=$1} /inet /{print iface, $2}' \
    | awk '$2 ~ /^(192\.168|10\.|172\.(1[6-9]|2[0-9]|3[01]))\./ {print $2; exit}'
}

# 1. Worker reachable from laptop.
if ! curl -fsS --max-time 2 "$WORKER_HEALTH_LOCAL" > /dev/null 2>&1; then
  red "✗ Worker not reachable at $WORKER_HEALTH_LOCAL"
  yellow "  Start it with: cd services/markets-worker && uv run uvicorn markets_worker.main:create_app --factory --host 0.0.0.0 --port $WORKER_PORT --reload"
  exit 1
fi
green "✓ Worker reachable on laptop loopback: $WORKER_HEALTH_LOCAL"

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

# 3a. Preferred path: phone reaches laptop directly over LAN.
LAN_IP=$(detect_lan_ip || true)
if [ -n "$LAN_IP" ]; then
  yellow "→ Trying LAN path: $LAN_IP"
  LAN_HEALTH=$(adb -s "$DEVICE_LINE" shell "curl -fsS --max-time 3 http://${LAN_IP}:${WORKER_PORT}/health 2>&1 || echo LAN_FAIL")
  if ! echo "$LAN_HEALTH" | grep -q 'LAN_FAIL'; then
    green "✓ Device reaches worker via LAN: $LAN_HEALTH"
    echo
    green "LAN path healthy — mobile:build:markets will bake http://${LAN_IP}:${WORKER_PORT}."
    exit 0
  fi
  yellow "✗ LAN path failed from device (likely AP isolation or different WiFi). Falling back to adb-reverse."
fi

# 3b. Fallback path: adb reverse tunnel (the legacy mode).
adb -s "$DEVICE_LINE" reverse tcp:${WORKER_PORT} tcp:${WORKER_PORT} > /dev/null
if ! adb -s "$DEVICE_LINE" reverse --list | grep -q "tcp:${WORKER_PORT} tcp:${WORKER_PORT}"; then
  red "✗ Failed to set adb reverse mapping"
  adb -s "$DEVICE_LINE" reverse --list
  exit 1
fi
green "✓ adb reverse tcp:${WORKER_PORT} -> laptop tcp:${WORKER_PORT}"

REV_HEALTH=$(adb -s "$DEVICE_LINE" shell "curl -fsS --max-time 2 http://127.0.0.1:${WORKER_PORT}/health 2>&1 || echo REV_FAIL")
if echo "$REV_HEALTH" | grep -q 'REV_FAIL'; then
  red "✗ Device cannot reach worker via adb-reverse either:"
  echo "  $REV_HEALTH"
  exit 1
fi
green "✓ Device reaches worker via adb-reverse: $REV_HEALTH"
echo
yellow "Using adb-reverse fallback — set MARKETS_WORKER_URL=http://127.0.0.1:${WORKER_PORT} when running mobile:build:markets to match."
