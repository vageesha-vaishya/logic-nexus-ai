#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "Running REST wipe for master/config tables..."
set -a
. ./new-supabase-config.env
set +a

# Allow insecure SSL if local CA bundle is incomplete
export ALLOW_INSECURE_SSL=true

python3 "$SCRIPT_DIR/rest-wipe.py"