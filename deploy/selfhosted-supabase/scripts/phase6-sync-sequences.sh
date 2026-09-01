#!/bin/bash
# Phase 6 cutover: sequence sync (production -> self-hosted).
#
# PostgreSQL logical replication does not replicate sequence state (only row
# data flows through a subscription). Self-hosted's sequences sit wherever
# they were left after the initial schema copy - unadvanced - while
# production's keep moving. Without this script, the first insert on
# self-hosted after cutover claims a low id against thousands of already-
# replicated rows: a primary-key violation, or silent duplication wherever a
# sequence backs a non-unique column.
#
# What this script does, for every sequence in every non-system schema:
#   1. Reads production's pg_sequences at run time (never a stored list -
#      the count is not fixed; it was 28 at spec-writing time and 24 when
#      this script was tested, purely from schema churn between those
#      dates - that drift is exactly why a hardcoded list would be wrong).
#   2. Reads self-hosted's pg_sequences at run time, same way.
#   3. For every sequence present on both sides with a non-null production
#      last_value: sets self-hosted's value to production's value plus a
#      safety margin (PHASE6_MARGIN), but ONLY if that is higher than
#      self-hosted's current value. Self-hosted is never lowered - if it is
#      already at or above the target (e.g. a re-run), the sequence is left
#      untouched and reported as such.
#   4. Sequences with a NULL last_value on production (never advanced there
#      either - e.g. a table nobody has inserted into yet) are reported and
#      skipped, not coerced to 0. Coercing to 0 would be actively wrong: it
#      would appear to "sync" a sequence that production simply hasn't used,
#      and setval'ing to 0 can conflict with a sequence's MINVALUE.
#   5. Sequences present on only one side are reported and skipped (not
#      silently ignored) - typically self-hosted-only platform-internal
#      sequences (graphql/pgsodium/supabase_functions schemas) that have no
#      production counterpart and must never be touched by this script.
#
# Idempotent and safe to re-run: a second run against an already-synced
# self-hosted makes zero changes (every sequence is already >= target), and
# reports that plainly rather than silently.
#
# Modes:
#   dry-run (default) - report only. No setval is executed. This is the
#                        mode used for pre-cutover verification.
#   apply              - actually raise self-hosted's sequences. This is the
#                        real cutover action and must only be run in the
#                        Task 3 window, after replication has been stopped
#                        (see spec: "sequences correct" is verified once,
#                        immediately before writes resume, not before).
#
# Usage:
#   ./phase6-sync-sequences.sh dry-run
#   ./phase6-sync-sequences.sh apply
#
# Required env vars:
#   PHASE6_DB_CONTAINER   - self-hosted Postgres container name. This is
#                           NOT stable across container recreates - re-verify
#                           it live (docker ps) before every run rather than
#                           trusting a value from an earlier session/report.
#   PHASE6_PROD_CONN      - full libpq connection string to production, using
#                           the TRUE DIRECT host, not the pooler. Despite
#                           their names, env's DATABASE_URL / DIRECT_URL /
#                           SUPABASE_DB_URL are all the pooled pgbouncer
#                           connection (aws-1-ap-south-1.pooler.supabase.com
#                           :6543, pgbouncer=true) and are not usable here
#                           (same constraint already documented for
#                           PHASE2_PROD_CONN / PHASE3_PROD_PG_CONN). Use:
#                             host=db.gzhxgoigflftharcmdqj.supabase.co
#                             port=5432 dbname=postgres user=postgres
#                             password=<postgres role password, same one in
#                             env's DIRECT_URL> sslmode=require
#
# Optional env vars:
#   PHASE6_SSH_HOST              - SSH alias for the VPS (default: hostinger-vps)
#   PHASE6_SELFHOSTED_PSQL_ARGS  - extra args to the self-hosted psql
#                                  invocation (default: "-U supabase_admin -d postgres")
#   PHASE6_MARGIN                - safety margin added on top of production's
#                                  last_value (default: 1000). Production
#                                  keeps advancing between this script's dry
#                                  runs and the real cutover-window run,
#                                  which reads production's value fresh each
#                                  time - the margin absorbs whatever writes
#                                  land between "read" and "self-hosted
#                                  starts serving", not between now and the
#                                  window.
#   PHASE6_LOG                   - log file (default: ./phase6-sync-sequences.log)
#   PHASE6_PROD_SEQ_TSV           - if set, read production's sequence list
#                                  from this local file instead of querying
#                                  production live. Format: one row per line,
#                                  "schema|sequence|last_value_or_NULL"
#                                  (NULL literal, not empty). This exists
#                                  for offline dry-run verification (e.g.
#                                  when production is queried through a
#                                  separate trusted channel and the result
#                                  captured to a file) - real dry-run and
#                                  apply runs should leave this unset so the
#                                  live query path is what gets exercised.
set -uo pipefail

: "${PHASE6_DB_CONTAINER:?Set PHASE6_DB_CONTAINER to the self-hosted Postgres container name (re-verify live - it is not stable across recreates)}"
PHASE6_SSH_HOST="${PHASE6_SSH_HOST:-hostinger-vps}"
PHASE6_SELFHOSTED_PSQL_ARGS="${PHASE6_SELFHOSTED_PSQL_ARGS:--U supabase_admin -d postgres}"
PHASE6_MARGIN="${PHASE6_MARGIN:-1000}"
LOG="${PHASE6_LOG:-./phase6-sync-sequences.log}"
MODE="${1:-dry-run}"

case "$MODE" in
  dry-run|apply) ;;
  *) echo "Usage: $0 [dry-run|apply]" >&2; exit 2 ;;
esac

if [ -z "${PHASE6_PROD_SEQ_TSV:-}" ]; then
  : "${PHASE6_PROD_CONN:?Set PHASE6_PROD_CONN to a direct (non-pooled) libpq connection string for production, or set PHASE6_PROD_SEQ_TSV to a captured snapshot for offline verification}"
fi

: > "$LOG"
log() { echo "$(date -u +%FT%TZ) $*" >> "$LOG"; }

ssh_selfhosted() {
  ssh -n -o BatchMode=yes -o ConnectTimeout=10 "$PHASE6_SSH_HOST" "$@"
}

SEQ_SQL="SELECT schemaname||'|'||sequencename||'|'||COALESCE(last_value::text,'NULL') FROM pg_sequences WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY schemaname, sequencename;"

log "START mode=$MODE margin=$PHASE6_MARGIN container=$PHASE6_DB_CONTAINER"

# --- 1. Enumerate production sequences dynamically -------------------------
if [ -n "${PHASE6_PROD_SEQ_TSV:-}" ]; then
  log "Reading production sequence snapshot from file: $PHASE6_PROD_SEQ_TSV (offline verification mode)"
  PROD_ROWS=$(cat "$PHASE6_PROD_SEQ_TSV")
else
  log "Querying production pg_sequences live via $PHASE6_DB_CONTAINER"
  PROD_ROWS=$(ssh_selfhosted "docker exec $PHASE6_DB_CONTAINER psql \"$PHASE6_PROD_CONN\" -tAc \"$SEQ_SQL\"" 2>>"$LOG")
  PROD_SSH_EXIT=$?
  if [ "$PROD_SSH_EXIT" -ne 0 ] || [ -z "$PROD_ROWS" ]; then
    echo "ERROR: failed to read production pg_sequences (ssh/docker exec/psql exited $PROD_SSH_EXIT, or returned no rows). See $LOG." >&2
    log "FATAL production enumeration failed, exit=$PROD_SSH_EXIT"
    exit 1
  fi
fi
PROD_COUNT=$(echo "$PROD_ROWS" | grep -c '.')
log "Production sequences enumerated: $PROD_COUNT"

# --- 2. Enumerate self-hosted sequences dynamically -------------------------
log "Querying self-hosted pg_sequences live via $PHASE6_DB_CONTAINER"
SELF_ROWS=$(ssh_selfhosted "docker exec $PHASE6_DB_CONTAINER psql $PHASE6_SELFHOSTED_PSQL_ARGS -tAc \"$SEQ_SQL\"" 2>>"$LOG")
SELF_SSH_EXIT=$?
if [ "$SELF_SSH_EXIT" -ne 0 ] || [ -z "$SELF_ROWS" ]; then
  echo "ERROR: failed to read self-hosted pg_sequences (ssh/docker exec/psql exited $SELF_SSH_EXIT, or returned no rows). See $LOG." >&2
  log "FATAL self-hosted enumeration failed, exit=$SELF_SSH_EXIT"
  exit 1
fi
SELF_COUNT=$(echo "$SELF_ROWS" | grep -c '.')
log "Self-hosted sequences enumerated: $SELF_COUNT"

# --- 3. Build lookup maps (schema|seq -> last_value_or_NULL) ---------------
declare -A PROD_VAL SELF_VAL PROD_SEEN SELF_SEEN

while IFS='|' read -r schema seq val; do
  [ -z "$schema" ] && continue
  key="${schema}.${seq}"
  PROD_VAL["$key"]="$val"
  PROD_SEEN["$key"]=1
done <<< "$PROD_ROWS"

while IFS='|' read -r schema seq val; do
  [ -z "$schema" ] && continue
  key="${schema}.${seq}"
  SELF_VAL["$key"]="$val"
  SELF_SEEN["$key"]=1
done <<< "$SELF_ROWS"

# --- 4. Walk the union of both key sets, deciding and (in apply mode) acting -
ALL_KEYS=$( { for k in "${!PROD_SEEN[@]}"; do echo "$k"; done; for k in "${!SELF_SEEN[@]}"; do echo "$k"; done; } | sort -u)

N_UPDATED=0 N_ALREADY_OK=0 N_PROD_NULL=0 N_MISSING_SELF=0 N_MISSING_PROD=0 N_FAILED=0

printf '%-70s %-14s %-14s %-14s %s\n' "SEQUENCE" "PROD_LAST" "SELF_BEFORE" "SELF_AFTER" "ACTION"
printf '%-70s %-14s %-14s %-14s %s\n' "--------" "---------" "-----------" "----------" "------"

for key in $ALL_KEYS; do
  in_prod="${PROD_SEEN[$key]:-0}"
  in_self="${SELF_SEEN[$key]:-0}"

  if [ "$in_prod" != "1" ]; then
    printf '%-70s %-14s %-14s %-14s %s\n' "$key" "-" "${SELF_VAL[$key]}" "${SELF_VAL[$key]}" "SKIP (missing on production)"
    log "SKIP $key: present on self-hosted only (not on production) - left untouched"
    N_MISSING_PROD=$((N_MISSING_PROD+1))
    continue
  fi

  if [ "$in_self" != "1" ]; then
    printf '%-70s %-14s %-14s %-14s %s\n' "$key" "${PROD_VAL[$key]}" "-" "-" "SKIP (missing on self-hosted)"
    log "SKIP $key: present on production only (not on self-hosted) - cannot sync, reported for follow-up"
    N_MISSING_SELF=$((N_MISSING_SELF+1))
    continue
  fi

  pval="${PROD_VAL[$key]}"
  sval="${SELF_VAL[$key]}"

  if [ "$pval" = "NULL" ]; then
    printf '%-70s %-14s %-14s %-14s %s\n' "$key" "NULL" "$sval" "$sval" "SKIP (production never advanced - not coerced to 0)"
    log "SKIP $key: production last_value IS NULL - never advanced there either, not coerced to 0"
    N_PROD_NULL=$((N_PROD_NULL+1))
    continue
  fi

  target=$((pval + PHASE6_MARGIN))
  scur=0
  [ "$sval" != "NULL" ] && scur="$sval"

  if [ "$scur" -ge "$target" ]; then
    printf '%-70s %-14s %-14s %-14s %s\n' "$key" "$pval" "$sval" "$sval" "OK (already >= target=$target, no change - never lowered)"
    log "OK $key: self-hosted ($scur) already >= target ($target) - left untouched"
    N_ALREADY_OK=$((N_ALREADY_OK+1))
    continue
  fi

  if [ "$MODE" = "dry-run" ]; then
    printf '%-70s %-14s %-14s %-14s %s\n' "$key" "$pval" "$sval" "$target" "WOULD SET (dry-run, no write performed)"
    log "WOULD-SET $key: self-hosted $scur -> $target (target = prod $pval + margin $PHASE6_MARGIN)"
    N_UPDATED=$((N_UPDATED+1))
    continue
  fi

  # apply mode: actually setval, then re-read to confirm.
  NEWVAL=$(ssh_selfhosted "docker exec $PHASE6_DB_CONTAINER psql $PHASE6_SELFHOSTED_PSQL_ARGS -tAc \"SELECT setval('${key}', ${target}, true);\"" 2>>"$LOG" | tr -d '[:space:]')
  if [ -z "$NEWVAL" ]; then
    printf '%-70s %-14s %-14s %-14s %s\n' "$key" "$pval" "$sval" "FAILED" "ERROR (setval failed - see log)"
    log "ERROR $key: setval to $target failed - see log above"
    N_FAILED=$((N_FAILED+1))
    continue
  fi
  printf '%-70s %-14s %-14s %-14s %s\n' "$key" "$pval" "$sval" "$NEWVAL" "SET"
  log "SET $key: self-hosted $scur -> $NEWVAL (target was $target)"
  N_UPDATED=$((N_UPDATED+1))
done

echo
echo "Summary (mode=$MODE, margin=$PHASE6_MARGIN):"
echo "  production sequences enumerated:        $PROD_COUNT"
echo "  self-hosted sequences enumerated:        $SELF_COUNT"
echo "  updated / would-update:                  $N_UPDATED"
echo "  already >= target (no change needed):    $N_ALREADY_OK"
echo "  skipped - production last_value IS NULL: $N_PROD_NULL"
echo "  skipped - missing on self-hosted:         $N_MISSING_SELF"
echo "  skipped - missing on production:          $N_MISSING_PROD"
echo "  failed:                                  $N_FAILED"
echo "See $LOG for the full run log."

log "DONE updated=$N_UPDATED ok=$N_ALREADY_OK prod_null=$N_PROD_NULL missing_self=$N_MISSING_SELF missing_prod=$N_MISSING_PROD failed=$N_FAILED"

[ "$N_FAILED" -eq 0 ]
