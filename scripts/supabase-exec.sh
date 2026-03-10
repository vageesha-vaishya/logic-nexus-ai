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
DB_URL="${SUPABASE_DB_URL:-}"

if [[ -z "${SQL_FILE}" ]]; then
  echo "Error: SQL file path is required"
  echo "Usage: $0 /absolute/or/relative/path/to.sql"
  exit 1
fi

if [[ ! -f "${SQL_FILE}" ]]; then
  echo "Error: SQL file not found: ${SQL_FILE}"
  exit 1
fi

if [[ -z "${DB_URL}" && -f "${ENV_FILE}" ]]; then
  set -a
  . "${ENV_FILE}"
  set +a
  DB_URL="${SUPABASE_DB_URL:-}"
fi

if [[ -z "${DB_URL}" ]]; then
  echo "Error: SUPABASE_DB_URL is not defined in environment or ${ENV_FILE}"
  exit 1
fi

echo "Executing SQL via Supabase CLI:"
echo "  File: ${SQL_FILE}"
SAFE_DB_URL=$(echo "${DB_URL}" | sed -E 's#(postgres(ql)?://[^:]+:)[^@]+@#\1****@#')
echo "  DB:   ${SAFE_DB_URL}"

# Execute SQL file against remote DB URL
# Strip pgbouncer param which causes psql error
CLEAN_DB_URL=$(echo "${DB_URL}" | sed 's/?pgbouncer=true//g' | sed 's/&pgbouncer=true//g')

if command -v psql >/dev/null 2>&1; then
  psql "${CLEAN_DB_URL}" -f "${SQL_FILE}"
else
  echo "Error: psql not found. Cannot execute migration directly."
  exit 1
fi
echo "✅ SQL executed successfully"
