#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SQL_DIR="${ROOT_DIR}/scripts/sql"
EXEC="${ROOT_DIR}/scripts/supabase-exec.sh"

if [[ ! -x "${EXEC}" ]]; then
  echo "Error: ${EXEC} is missing or not executable"
  exit 1
fi

echo "== UIM cleanup: truncate with before/after audit counts =="
"${EXEC}" "${SQL_DIR}/uim_cleanup_truncate_with_audit.sql"

echo "== UIM seed: aviation MRO reference dataset (900 records baseline) =="
"${EXEC}" "${SQL_DIR}/uim_seed_aviation_mro_dataset.sql"

echo "== Completed UIM reset + reseed successfully =="
