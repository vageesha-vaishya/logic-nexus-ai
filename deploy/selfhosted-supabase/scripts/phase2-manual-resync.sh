#!/bin/bash
# Phase 2 manual data re-sync: dumps every table in a list from production and
# loads it into self-hosted, bypassing Postgres's native logical-replication
# tablesync mechanism entirely.
#
# Use this as step 2 of the "Rebuilding after slot invalidation" procedure in
# ../README.md, or any time the built-in tablesync process is unreliable and
# you need to seed/re-seed table data directly.
#
# Per-table technique (see the Phase 2 SDD ledger for the full story of why):
#   - explicit, non-generated column list (via pg_attribute) on both the dump
#     SELECT and the load COPY target, to avoid column-count/order mismatches
#   - SET LOCAL session_replication_role = replica during the load, to bypass
#     FK/trigger ordering issues without needing topological table ordering
#     (this mirrors how logical replication's own apply worker behaves)
#   - DELETE FROM (not TRUNCATE) before reload, since TRUNCATE fails on any
#     table referenced by an FK, even from an empty table
#
# Required env vars:
#   PHASE2_PROD_CONN   - full libpq connection string to production, e.g.
#                        "host=db.<ref>.supabase.co port=5432 dbname=postgres user=phase2_replicator password=... sslmode=require"
#                        (must be a DIRECT connection, not a pooler - logical
#                        replication / consistent snapshots need it)
#   PHASE2_SSH_HOST    - SSH alias/host for the VPS running self-hosted Postgres
#   PHASE2_DB_CONTAINER- self-hosted Postgres container name
#   PHASE2_TABLE_LIST  - path to a local file, one schema-qualified table name
#                        per line (e.g. `public.accounts` or bare `accounts`
#                        if in the default search_path). Generate one with:
#                        psql ... -tAc "SELECT srrelid::regclass FROM pg_subscription_rel WHERE srsubid=<subid> ORDER BY 1;" > tables.txt
#                        or, for every table in a publication:
#                        psql ... -tAc "SELECT schemaname||'.'||tablename FROM pg_publication_tables WHERE pubname='<pub>' ORDER BY 1;" > tables.txt
#
# Optional env vars:
#   PHASE2_LOG         - log file path (default: ./phase2-manual-resync.log)
#   PHASE2_SELFHOSTED_PSQL_ARGS - extra args to the self-hosted psql invocation
#                        (default: "-U supabase_admin -d postgres")
set -uo pipefail

: "${PHASE2_PROD_CONN:?Set PHASE2_PROD_CONN to a direct (non-pooled) libpq connection string for production}"
: "${PHASE2_SSH_HOST:?Set PHASE2_SSH_HOST to the SSH alias for the self-hosted VPS}"
: "${PHASE2_DB_CONTAINER:?Set PHASE2_DB_CONTAINER to the self-hosted Postgres container name}"
: "${PHASE2_TABLE_LIST:?Set PHASE2_TABLE_LIST to a file with one schema-qualified table name per line}"

LOG="${PHASE2_LOG:-./phase2-manual-resync.log}"
SELFHOSTED_PSQL_ARGS="${PHASE2_SELFHOSTED_PSQL_ARGS:--U supabase_admin -d postgres}"
SEEDDIR=/tmp/phase2_manual_resync_data

ssh -n -o BatchMode=yes -o ConnectTimeout=8 "$PHASE2_SSH_HOST" "docker exec $PHASE2_DB_CONTAINER mkdir -p $SEEDDIR"
: > "$LOG"
TOTAL=$(wc -l < "$PHASE2_TABLE_LIST" | tr -d ' ')
DONE=0; OK=0; FAIL=0
echo "$(date -u) START total=$TOTAL" >> "$LOG"

while IFS= read -r TBL; do
  [ -z "$TBL" ] && continue
  DONE=$((DONE+1))
  SAFE=$(echo "$TBL" | tr -c 'A-Za-z0-9_' '_')

  COLS=$(ssh -n -o BatchMode=yes -o ConnectTimeout=8 "$PHASE2_SSH_HOST" \
    "docker exec $PHASE2_DB_CONTAINER psql '$PHASE2_PROD_CONN' -tAc \"SELECT string_agg(quote_ident(attname), ',' ORDER BY attnum) FROM pg_attribute WHERE attrelid='${TBL}'::regclass AND attnum>0 AND NOT attisdropped AND attgenerated='';\"" \
    | tr -d '\r')
  if [ -z "$COLS" ]; then
    echo "$(date -u) [$DONE/$TOTAL] FAIL(no-cols) $TBL" >> "$LOG"
    FAIL=$((FAIL+1)); continue
  fi

  DUMP_SQL="\copy (SELECT ${COLS} FROM ${TBL}) TO '$SEEDDIR/${SAFE}.csv' WITH (FORMAT csv)"
  if ! echo "$DUMP_SQL" | ssh -o BatchMode=yes -o ConnectTimeout=8 "$PHASE2_SSH_HOST" \
    "docker exec -i $PHASE2_DB_CONTAINER psql '$PHASE2_PROD_CONN' -v ON_ERROR_STOP=1" >> "$LOG" 2>&1; then
    echo "$(date -u) [$DONE/$TOTAL] FAIL(dump) $TBL" >> "$LOG"
    FAIL=$((FAIL+1)); continue
  fi

  LOAD_SQL="BEGIN;
SET LOCAL session_replication_role = replica;
DELETE FROM ${TBL};
\copy ${TBL} (${COLS}) FROM '$SEEDDIR/${SAFE}.csv' WITH (FORMAT csv)
COMMIT;"
  if echo "$LOAD_SQL" | ssh -o BatchMode=yes -o ConnectTimeout=8 "$PHASE2_SSH_HOST" \
    "docker exec -i $PHASE2_DB_CONTAINER psql $SELFHOSTED_PSQL_ARGS -v ON_ERROR_STOP=1" >> "$LOG" 2>&1; then
    echo "$(date -u) [$DONE/$TOTAL] OK $TBL" >> "$LOG"
    OK=$((OK+1))
  else
    echo "$(date -u) [$DONE/$TOTAL] FAIL(load) $TBL" >> "$LOG"
    FAIL=$((FAIL+1))
  fi

  ssh -n -o BatchMode=yes -o ConnectTimeout=8 "$PHASE2_SSH_HOST" "docker exec $PHASE2_DB_CONTAINER rm -f $SEEDDIR/${SAFE}.csv" >/dev/null 2>&1
done < "$PHASE2_TABLE_LIST"

echo "$(date -u) DONE total=$TOTAL ok=$OK fail=$FAIL" >> "$LOG"
echo "Done. $OK/$TOTAL succeeded, $FAIL failed. See $LOG for detail."
[ "$FAIL" -eq 0 ]
