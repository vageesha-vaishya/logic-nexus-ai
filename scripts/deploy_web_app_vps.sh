#!/bin/bash
set -e

# Usage: ./scripts/deploy_web_app_vps.sh <vps_ip> <vps_user> <vps_password> [gateway_port] [app_port] [anon_key]
# Example: ./scripts/deploy_web_app_vps.sh 72.61.249.111 root '#@January@2026#' 8100 8099 "$SUPABASE_ANON_KEY"
#
# Purpose:
# - Builds the LogicPro web image on the VPS and runs it on a chosen host port
# - Uses gateway_port to form VITE_SUPABASE_URL (http://<VPS_IP>:<gateway_port>)

VPS_IP="$1"
VPS_USER="$2"
VPS_PASSWORD="$3"
GATEWAY_PORT="${4:-8100}"
APP_PORT="${5:-8099}"
SUPABASE_ANON_KEY="$6"

if [ -z "$VPS_IP" ] || [ -z "$VPS_USER" ] || [ -z "$VPS_PASSWORD" ]; then
  echo "Usage: ./scripts/deploy_web_app_vps.sh <vps_ip> <vps_user> <vps_password> [gateway_port] [app_port] [anon_key]"
  exit 1
fi

if [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "Warning: anon key not provided as 6th argument. Attempting to read from repo .env"
  SUPABASE_ANON_KEY=$(grep -E '^SUPABASE_ANON_KEY=' .env | sed -E 's/^SUPABASE_ANON_KEY=\"?//' | sed -E 's/\"?$//')
  if [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "Error: Could not resolve SUPABASE_ANON_KEY"
    exit 1
  fi
fi

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
EXPECT_EXEC="$SCRIPT_DIR/remote_exec.expect"

if [ ! -f "$EXPECT_EXEC" ]; then
  echo "Missing helper: $EXPECT_EXEC"
  exit 1
fi

REMOTE_APP_DIR="/home/SOSLogicPro/logicProSupabaseDev/logic-nexus-ai"
REMOTE_DOCKERFILE="$REMOTE_APP_DIR/Dockerfile"
SUPABASE_URL="http://${VPS_IP}:${GATEWAY_PORT}"

echo "Building LogicPro web on VPS (context: $REMOTE_APP_DIR, URL: $SUPABASE_URL) ..."
"$EXPECT_EXEC" "$VPS_IP" "$VPS_USER" "$VPS_PASSWORD" "\
  cd $REMOTE_APP_DIR && \
  docker build -t logicpro-web \
    --build-arg VITE_SUPABASE_URL='$SUPABASE_URL' \
    --build-arg VITE_SUPABASE_ANON_KEY='$SUPABASE_ANON_KEY' \
    -f $REMOTE_DOCKERFILE \
    $REMOTE_APP_DIR \
"

echo "Starting logicpro-web on port $APP_PORT ..."
"$EXPECT_EXEC" "$VPS_IP" "$VPS_USER" "$VPS_PASSWORD" "\
  (docker ps -a --format '{{.Names}}' | grep -q '^logicpro-web\$' && docker rm -f logicpro-web || true) && \
  docker run -d --name logicpro-web --restart unless-stopped -p ${APP_PORT}:80 logicpro-web \
"

echo "LogicPro web is available at http://${VPS_IP}:${APP_PORT}"
