#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ ! -f "new-supabase-config.env" ]]; then
  echo "new-supabase-config.env not found in $(pwd)" >&2
  exit 1
fi

set -a
source ./new-supabase-config.env
set +a

export ALLOW_INSECURE_SSL=true

echo "Running REST importer for master/config tables..."
python3 ./import-rest.py