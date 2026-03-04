#!/bin/bash
set -e

# Usage: ./scripts/setup_supabase_gateway_vps.sh <vps_ip> <vps_user> <vps_password> [gateway_port]
# Example: ./scripts/setup_supabase_gateway_vps.sh 72.61.249.111 root '#@January@2026#' 8100
#
# Purpose:
# - Creates/updates an Nginx reverse proxy container on the VPS to expose Supabase Kong on a safe host port
# - Avoids conflict with Coolify (port 8000)
# - Default gateway port: 8100

VPS_IP="$1"
VPS_USER="$2"
VPS_PASSWORD="$3"
GATEWAY_PORT="${4:-8100}"

if [ -z "$VPS_IP" ] || [ -z "$VPS_USER" ] || [ -z "$VPS_PASSWORD" ]; then
  echo "Usage: ./scripts/setup_supabase_gateway_vps.sh <vps_ip> <vps_user> <vps_password> [gateway_port]"
  exit 1
fi

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
EXPECT_EXEC="$SCRIPT_DIR/remote_exec.expect"
EXPECT_SCP="$SCRIPT_DIR/remote_scp.expect"

if [ ! -f "$EXPECT_EXEC" ] || [ ! -f "$EXPECT_SCP" ]; then
  echo "Missing expect helpers: $EXPECT_EXEC or $EXPECT_SCP"
  exit 1
fi

REMOTE_BASE="/home/SOSLogicPro/logicProSupabaseDev"
REMOTE_CONF="$REMOTE_BASE/nginx-supabase.conf"

TMP_CONF="$(mktemp)"
cat > "$TMP_CONF" <<EOF
server {
  listen 80;
  server_name _;
  location / {
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_pass http://supabase-kong:8000;
  }
}
EOF

echo "Uploading Nginx gateway config to $REMOTE_CONF ..."
"$EXPECT_EXEC" "$VPS_IP" "$VPS_USER" "$VPS_PASSWORD" "mkdir -p $REMOTE_BASE"
"$EXPECT_SCP" "$TMP_CONF" "$VPS_USER" "$VPS_IP" "$REMOTE_CONF" "$VPS_PASSWORD"
rm -f "$TMP_CONF"

echo "Ensuring Docker network 'supabase-network' exists..."
"$EXPECT_EXEC" "$VPS_IP" "$VPS_USER" "$VPS_PASSWORD" "docker network ls --format '{{.Name}}' | grep -q '^supabase-network\$' || docker network create supabase-network"

echo "Starting/Updating supabase-gateway container on port $GATEWAY_PORT ..."
"$EXPECT_EXEC" "$VPS_IP" "$VPS_USER" "$VPS_PASSWORD" "\
  (docker ps -a --format '{{.Names}}' | grep -q '^supabase-gateway\$' && docker rm -f supabase-gateway || true) && \
  docker run -d --name supabase-gateway --restart unless-stopped \
    --network supabase-network -p ${GATEWAY_PORT}:80 \
    -v ${REMOTE_CONF}:/etc/nginx/conf.d/default.conf:ro \
    nginx:stable \
"

echo "Supabase gateway is ready on http://${VPS_IP}:${GATEWAY_PORT}"
