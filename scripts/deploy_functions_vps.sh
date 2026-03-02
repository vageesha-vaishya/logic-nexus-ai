#!/bin/bash
set -e

# Usage: ./deploy_functions_vps.sh <vps_ip> <vps_user> <vps_password>
# Example: ./deploy_functions_vps.sh 72.61.249.111 root '#@January@2026#'

VPS_IP=$1
VPS_USER=$2
VPS_PASSWORD=$3
REMOTE_PATH="/home/SOSLogicPro/logicProSupabaseDev/docker/volumes/functions"

if [ -z "$VPS_IP" ] || [ -z "$VPS_USER" ] || [ -z "$VPS_PASSWORD" ]; then
    echo "Usage: ./deploy_functions_vps.sh <vps_ip> <vps_user> <vps_password>"
    exit 1
fi

# Resolve script directory to handle relative paths correctly
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
EXPECT_SCP="$DIR/remote_scp.expect"
EXPECT_EXEC="$DIR/remote_exec.expect"

echo "Deploying functions to VPS $VPS_IP..."

# Check if 'expect' command is available
if ! command -v expect &> /dev/null; then
    echo "Error: 'expect' command not found. Please install 'expect' package."
    exit 1
fi

# Check if expect scripts exist
if [ ! -f "$EXPECT_SCP" ]; then
    echo "Error: $EXPECT_SCP not found."
    exit 1
fi

if [ ! -f "$EXPECT_EXEC" ]; then
    echo "Error: $EXPECT_EXEC not found."
    exit 1
fi

# Ensure scripts are executable
chmod +x "$EXPECT_SCP"
chmod +x "$EXPECT_EXEC"

# Copy functions
# Note: We copy the *contents* of supabase/functions to the remote path
# But remote_scp.expect copies the source directory itself if we point to it.
# We want to copy supabase/functions/* to remote/functions/
# This is tricky with scp -r.
# Easiest way: Copy supabase/functions to remote /tmp/functions, then move contents.

TEMP_REMOTE="/tmp/functions_deploy"

# 1. Clear temp on remote
"$EXPECT_EXEC" "$VPS_IP" "$VPS_USER" "$VPS_PASSWORD" "rm -rf $TEMP_REMOTE && mkdir -p $TEMP_REMOTE"

# 2. Copy local functions folder to temp
echo "Copying files..."
"$EXPECT_SCP" "supabase/functions" "$VPS_USER" "$VPS_IP" "$TEMP_REMOTE" "$VPS_PASSWORD"

# 3. Move from temp/functions/* to destination
# We need to preserve existing if needed? No, usually overwrite.
# But destination is a volume mount.
echo "Updating volume..."
"$EXPECT_EXEC" "$VPS_IP" "$VPS_USER" "$VPS_PASSWORD" "cp -r $TEMP_REMOTE/functions/* $REMOTE_PATH/ && rm -rf $TEMP_REMOTE"

echo "Deployment complete."
