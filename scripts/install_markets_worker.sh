#!/usr/bin/env bash
# Install / upgrade markets-worker on the VPS, running locally on the box.
# Idempotent: safe to re-run. First run installs python3.12 + deps (~5 min).
#
# Usage (on the VPS as root):
#   bash scripts/install_markets_worker.sh
#
# Required env (export before running, or pass on command line):
#   SUPABASE_URL                 — required (e.g. https://<project>.supabase.co)
#   SUPABASE_SERVICE_ROLE_KEY    — required
#
# Optional env:
#   OPENAI_API_KEY, ANTHROPIC_API_KEY, OPENROUTER_API_KEY  — LLM providers
#   MARKETS_WORKER_PORT          — default 8001

set -euo pipefail

REPO_DIR="/home/SOSLogicPro/logicProSupabaseDev/logic-nexus-ai"
WORKER_DIR="$REPO_DIR/services/markets-worker"
ENV_FILE="/etc/logic-nexus/markets-worker.env"
SERVICE_FILE="/etc/systemd/system/markets-worker.service"
PORT="${MARKETS_WORKER_PORT:-8001}"

: "${SUPABASE_URL:?must be set (export SUPABASE_URL=https://<project>.supabase.co)}"
: "${SUPABASE_SERVICE_ROLE_KEY:?must be set (export SUPABASE_SERVICE_ROLE_KEY=...)}"

echo "▶ 1/6 ensure python3.12 on PATH"
if ! command -v python3.12 >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y -qq software-properties-common
  add-apt-repository -y ppa:deadsnakes/ppa
  apt-get update -qq
fi
apt-get install -y -qq python3.12 python3.12-venv python3.12-dev build-essential pkg-config curl

echo "▶ 2/6 worker venv + editable install"
cd "$WORKER_DIR"
if [ ! -d .venv ]; then
  python3.12 -m venv .venv
fi
.venv/bin/pip install -q -U pip wheel setuptools
.venv/bin/pip install -q -e .

echo "▶ 3/6 write env file ($ENV_FILE, mode 600)"
mkdir -p /etc/logic-nexus
chmod 700 /etc/logic-nexus
{
  echo "SUPABASE_URL=$SUPABASE_URL"
  echo "SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY"
  [ -n "${SUPABASE_JWT_SECRET:-}" ]   && echo "SUPABASE_JWT_SECRET=$SUPABASE_JWT_SECRET"
  [ -n "${OPENAI_API_KEY:-}" ]        && echo "OPENAI_API_KEY=$OPENAI_API_KEY"
  [ -n "${ANTHROPIC_API_KEY:-}" ]     && echo "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY"
  [ -n "${OPENROUTER_API_KEY:-}" ]    && echo "OPENROUTER_API_KEY=$OPENROUTER_API_KEY"
  echo "ENVIRONMENT=production"
  echo "LOG_LEVEL=INFO"
} >"$ENV_FILE"
chmod 600 "$ENV_FILE"

echo "▶ 4/6 write systemd unit ($SERVICE_FILE)"
cat >"$SERVICE_FILE" <<UNIT
[Unit]
Description=Logic Nexus AI markets worker
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=$WORKER_DIR
EnvironmentFile=$ENV_FILE
ExecStart=$WORKER_DIR/.venv/bin/uvicorn markets_worker.main:create_app --factory --host 0.0.0.0 --port $PORT --proxy-headers --no-access-log --log-level info
Restart=on-failure
RestartSec=5
LimitNOFILE=65535
StandardOutput=journal
StandardError=journal
SyslogIdentifier=markets-worker

[Install]
WantedBy=multi-user.target
UNIT

echo "▶ 5/6 reload + restart"
systemctl daemon-reload
systemctl enable --quiet markets-worker
systemctl restart markets-worker

echo "▶ 6/6 health probe"
OK=""
for i in $(seq 1 30); do
  CODE=$(curl -s --max-time 5 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/health" 2>/dev/null || true)
  if [ "$CODE" = "200" ]; then OK="yes"; break; fi
  echo "  probe $i/30: http_code=$CODE"
  sleep 2
done
if [ -z "$OK" ]; then
  echo "✗ worker did not become healthy"
  echo "--- last 80 journal lines ---"
  journalctl -u markets-worker -n 80 --no-pager || true
  exit 1
fi
echo "✓ markets-worker healthy on 127.0.0.1:$PORT"
echo "  refresh the browser — /api/markets/* should now return 200."
