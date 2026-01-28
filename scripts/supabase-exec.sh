#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/supabase-exec.sh /path/to/sql_file.sql
# 
# Requirements:
# - .env.migration with SUPABASE_DB_URL defined
# - npx available (Node.js)
# - No need for Docker; executes against remote DB

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

ENV_FILE="${PROJECT_ROOT}/.env.migration"
SQL_FILE="${1:-}"

if [[ -z "${SQL_FILE}" ]]; then
  echo "Error: SQL file path is required"
  echo "Usage: $0 /absolute/or/relative/path/to.sql"
  exit 1
fi

if [[ ! -f "${SQL_FILE}" ]]; then
  echo "Error: SQL file not found: ${SQL_FILE}"
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Error: .env.migration not found at ${ENV_FILE}"
  echo "Please create it with SUPABASE_DB_URL and SUPABASE_ACCESS_TOKEN if needed."
  exit 1
fi

# Load .env.migration safely into current shell
set -a
. "${ENV_FILE}"
set +a

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "Error: SUPABASE_DB_URL not defined in .env.migration"
  exit 1
fi

echo "Executing SQL via Supabase CLI:"
echo "  File: ${SQL_FILE}"
echo "  DB:   ${SUPABASE_DB_URL}"

# Execute SQL file against remote DB URL
if command -v psql >/dev/null 2>&1; then
  psql "${SUPABASE_DB_URL}" -f "${SQL_FILE}"
else
  echo "Error: psql not found. Cannot execute migration directly."
  exit 1
fi
echo "✅ SQL executed successfully"

