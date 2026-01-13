#!/usr/bin/env bash
set -euo pipefail

# Purpose: Configure Supabase CLI for this project and link to Cloud project.
# - Non-interactive login if SUPABASE_ACCESS_TOKEN is present in .env.migration
# - Link project ref from environment
# - Verify CLI and Docker prerequisites

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env.migration"

echo "== Supabase CLI Setup =="

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is required. Please install Node.js (https://nodejs.org)."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Warning: Docker is not installed or not in PATH."
  echo "Local Supabase (status/start/stop) requires Docker Desktop on macOS."
else
  if ! docker info >/dev/null 2>&1; then
    echo "Warning: Docker daemon is not running. Start Docker Desktop for local Supabase."
  else
    echo "✓ Docker is running."
  fi
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Note: .env.migration not found; skipping non-interactive login/link."
  echo "You can still use 'npx supabase login' and 'npx supabase link --project-ref <ref>' manually."
  exit 0
fi

set -a
. "${ENV_FILE}"
set +a

if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "Logging into Supabase CLI using access token from .env.migration..."
  npx supabase login --token "${SUPABASE_ACCESS_TOKEN}"
  echo "✓ Supabase CLI login completed."
else
  echo "Note: SUPABASE_ACCESS_TOKEN missing in .env.migration; run 'npx supabase login' interactively."
fi

PROJECT_REF="${VITE_SUPABASE_PROJECT_ID:-}"
if [[ -z "${PROJECT_REF}" && -n "${SUPABASE_PROJECT_REF:-}" ]]; then
  PROJECT_REF="${SUPABASE_PROJECT_REF}"
fi
if [[ -z "${PROJECT_REF}" ]]; then
  echo "Warning: VITE_SUPABASE_PROJECT_ID or SUPABASE_PROJECT_REF not set in environment (.env or .env.migration)."
  echo "Set it and run: npx supabase link --project-ref <your-project-ref>"
  exit 0
fi

echo "Linking CLI to project ref: ${PROJECT_REF}"
npx supabase link --project-ref "${PROJECT_REF}"
echo "✓ Supabase CLI linked to project."

echo "Setup complete."
