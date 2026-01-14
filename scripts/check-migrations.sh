#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

TS="$(date -u +"%Y-%m-%dT%H-%M-%SZ")"
LOG_FILE="${SCRIPT_DIR}/check-migrations-${TS}.log"

log() {
  printf '[%s] %s\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$1" | tee -a "$LOG_FILE"
}

run_step() {
  local label="$1"
  shift
  log "$label: $*"
  if ! "$@" 2>&1 | tee -a "$LOG_FILE"; then
    log "ERROR during: $label"
    exit 1
  fi
}

log "Starting Supabase migration check"
run_step "Supabase status" npx supabase status
run_step "Applying pending migrations" npx supabase db push --linked --non-interactive
log "Supabase migration check completed successfully"

