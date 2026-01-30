#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"

if [[ -f "${ENV_FILE}" ]]; then
  . "${ENV_FILE}"
fi

PROJECT_REF="${SUPABASE_PROJECT_REF:-${VITE_SUPABASE_PROJECT_ID:-}}"
if [[ -z "${PROJECT_REF}" ]]; then
  echo "Error: Project ref not found. Set VITE_SUPABASE_PROJECT_ID in .env or SUPABASE_PROJECT_REF in environment."
  exit 1
fi

if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
  echo "Error: SUPABASE_DB_PASSWORD is not set. Export it in your shell before running this script."
  echo "Example: export SUPABASE_DB_PASSWORD='your-db-password'"
  exit 1
fi

DB_HOST="${SUPABASE_DB_HOST:-aws-1-ap-south-1.pooler.supabase.com}"
DB_NAME="${SUPABASE_DB_NAME:-postgres}"
DB_USER="postgres.${PROJECT_REF}"
DB_URL="postgresql://${DB_USER}@${DB_HOST}:5432/${DB_NAME}"

cmd="${1:-}"
shift || true

case "${cmd}" in
  list)
    PGPASSWORD="${SUPABASE_DB_PASSWORD}" ~/Downloads/cli_temp/supabase migration list --db-url "${DB_URL}" "$@"
    ;;
  push)
    PGPASSWORD="${SUPABASE_DB_PASSWORD}" ~/Downloads/cli_temp/supabase db push --db-url "${DB_URL}" "$@"
    ;;
  *)
    echo "Usage:"
    echo "  SUPABASE_DB_PASSWORD=... ./scripts/supabase-remote.sh list"
    echo "  SUPABASE_DB_PASSWORD=... ./scripts/supabase-remote.sh push [--include-all]"
    exit 2
    ;;
esac
