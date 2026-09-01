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
#      the count is not fixed and must not be hardcoded: production currently
#      has 25 sequences, self-hosted currently has more (it also carries a
#      handful of platform-internal sequences - graphql/pgsodium/
#      supabase_functions schemas - that have no production counterpart and
#      must never be touched by this script). Either count can legitimately
#      change as the schema evolves, which is why enumeration is always live
#      and never a fixed list.
#   2. Reads self-hosted's pg_sequences at run time, same way.
#   3. For every sequence present on both sides, resolves its OWNING COLUMN
#      via pg_depend (the column a SERIAL/OWNED BY/IDENTITY sequence feeds),
#      and computes production's target as:
#        GREATEST(COALESCE(prod last_value, 0), COALESCE(max(owning col), 0))
#        + PHASE6_MARGIN
#      This is the critical correctness property of this script:
#      `last_value IS NULL` on a sequence means `is_called = false` - it does
#      NOT mean the owning table is empty. A table can be, and in this
#      database IS, bulk-loaded with explicit ids (bypassing nextval
#      entirely) while its identity sequence never advances and reports
#      last_value NULL forever. Relying on last_value alone - as this script
#      used to - would sync such a sequence to 0 + margin against a table
#      that already holds thousands of rows with much higher ids, and the
#      first post-cutover insert would collide. Reading the owning column's
#      actual max() is what makes the sync correct regardless of whether
#      rows arrived via nextval or via bulk load. NULL is treated as 0 only
#      inside that GREATEST - it is never passed to setval directly.
#      Sequences with no owning column (cron.jobid_seq, cron.runid_seq,
#      public.billing_invoice_seq) fall back to last_value alone; there is no
#      table to check.
#      The owning column's max() is read from PRODUCTION only, not
#      self-hosted: production is authoritative at cutover time (it holds
#      whatever writes have happened up to the moment replication is
#      stopped), and self-hosted's copy of the same table is expected to be
#      an exact mirror of it at that point - reading self-hosted's max()
#      instead would use a value that could be short a few just-replicated
#      rows and would tell us nothing that reading self-hosted's own
#      last_value doesn't already tell us far more cheaply.
#   4. Self-hosted is never lowered - if it is already at or above the
#      target (e.g. a re-run), the sequence is left untouched and reported
#      as such.
#   5. A sequence is only skipped as "genuinely never used" when the owning
#      column has zero rows (aggregate MAX over zero rows is NULL - not the
#      same as MAX returning 0, which is a real value and is synced
#      normally), or, for a standalone sequence with no owning column, when
#      its own last_value is NULL. Coercing either case to 0 would be
#      actively wrong - it would appear to "sync" a sequence production
#      simply hasn't used, and setval'ing to 0 can conflict with a
#      sequence's MINVALUE. Both skip cases are reported distinctly, not
#      merged into one "SKIP" bucket.
#   6. Sequences present on only one side are reported and skipped, but NOT
#      treated as equally harmless: a sequence present on self-hosted only
#      is typically one of the platform-internal ones described in (1) and
#      is genuinely fine to leave alone. A sequence present on PRODUCTION
#      only, with no self-hosted counterpart, means logical replication -
#      which carries no DDL - left a whole TABLE missing on self-hosted. That
#      is the loudest available signal that the replica is structurally
#      incomplete, and this script now fails loudly (non-zero exit) rather
#      than reporting one quiet SKIP line and exiting 0.
#   7. Every target is bounds-checked against the sequence's own max_value
#      (several sequences in this schema are `integer`-typed, max_value
#      2147483647) and against going negative. A target that would exceed
#      max_value or come out negative is reported as an ERROR, not silently
#      accepted as satisfied.
#
# Idempotent and safe to re-run: a second run against an already-synced
# self-hosted makes zero changes (every sequence is already >= target), and
# reports that plainly rather than silently. A final, independent
# verification pass re-reads BOTH sides fresh at the end of the run and
# asserts, for every shared sequence, that self-hosted's current value is at
# or above production's true floor (GREATEST(last_value, max(owning col)),
# margin NOT included - the margin is a cutover-window safety cushion, not
# part of the correctness floor). That assertion is printed as the last line
# of output and, in apply mode, its failure is a hard non-zero exit: this is
# what turns the script's own output into something Task 3's runbook can
# actually treat as proof the step succeeded, rather than "psql printed
# something and nothing crashed".
#
# Modes:
#   dry-run (default) - report only. No setval is executed. This is the
#                        mode used for pre-cutover verification.
#   apply              - actually raise self-hosted's sequences. This is the
#                        real cutover action and must only be run in the
#                        Task 3 window, after replication has been stopped
#                        (see spec: "sequences correct" is verified once,
#                        immediately before writes resume, not before). A
#                        preflight guard refuses to run apply while any
#                        subscription still exists on self-hosted - apply
#                        assumes replication is already gone, and a
#                        surviving subscription means it is not.
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
#   PHASE6_MARGIN                - safety margin added on top of the target
#                                  floor described in (3) above (default: 25).
#                                  Production keeps advancing between this
#                                  script's dry runs and the real
#                                  cutover-window run, which reads production
#                                  fresh each time - the margin absorbs
#                                  whatever writes land between "read" and
#                                  "self-hosted starts serving", not between
#                                  now and the window. It used to default to
#                                  1000 when the target was sequence-only and
#                                  the margin was doing double duty covering
#                                  for data drift it could not otherwise
#                                  detect; now that the target is grounded in
#                                  the owning column's real max(), the margin
#                                  only needs to cover that short window, and
#                                  a four-figure jump is actively harmful on
#                                  user-visible document series (e.g.
#                                  public.directives.directive_sequence, or
#                                  public.billing_invoice_seq which feeds
#                                  'INV-'||year||'-'||lpad(nextval(...),4,'0')
#                                  - a 1000 jump burns most of that 4-digit
#                                  field).
#   PHASE6_LOG                   - log file (default: ./phase6-sync-sequences.log).
#                                  Appended to, never truncated - each run
#                                  writes a RUN MARKER line rather than
#                                  wiping prior history, so the record of a
#                                  failed run being retried survives.
#   PHASE6_PROD_SEQ_TSV           - if set, read production's sequence list
#                                  from this local file instead of querying
#                                  production live. Format: one row per line,
#                                  pipe-delimited:
#                                    schema|sequence|last_value|owner_column|max_owner_value|max_value
#                                  where last_value and max_owner_value use
#                                  the literal string NULL (not empty) when
#                                  null, owner_column is '-' for a standalone
#                                  sequence with no owning column, and
#                                  max_value is the sequence's own max_value
#                                  (always numeric). This exists for offline
#                                  dry-run verification (e.g. when production
#                                  is queried through a separate trusted
#                                  channel and the result captured to a
#                                  file). REFUSED in apply mode (see below) -
#                                  real dry-run and apply runs should leave
#                                  this unset so the live query path is what
#                                  gets exercised.
set -uo pipefail

: "${PHASE6_DB_CONTAINER:?Set PHASE6_DB_CONTAINER to the self-hosted Postgres container name (re-verify live - it is not stable across recreates)}"
PHASE6_SSH_HOST="${PHASE6_SSH_HOST:-hostinger-vps}"
PHASE6_SELFHOSTED_PSQL_ARGS="${PHASE6_SELFHOSTED_PSQL_ARGS:--U supabase_admin -d postgres}"
PHASE6_MARGIN="${PHASE6_MARGIN:-25}"
LOG="${PHASE6_LOG:-./phase6-sync-sequences.log}"
MODE="${1:-dry-run}"

case "$MODE" in
  dry-run|apply) ;;
  *) echo "Usage: $0 [dry-run|apply]" >&2; exit 2 ;;
esac

if ! [[ "$PHASE6_MARGIN" =~ ^[0-9]+$ ]]; then
  echo "ERROR: PHASE6_MARGIN must be a non-negative integer, got '$PHASE6_MARGIN'" >&2
  exit 2
fi

# Fix 4: apply must never honour the offline snapshot. If PHASE6_PROD_SEQ_TSV
# is still exported in the operator's shell during the cutover window, an
# apply run would silently sync from a stale file while everyone believes
# production was just read live at the point of no return.
if [ "$MODE" = "apply" ] && [ -n "${PHASE6_PROD_SEQ_TSV:-}" ]; then
  echo "ERROR: PHASE6_PROD_SEQ_TSV is set but MODE=apply. Apply must read production live - refusing to sync from a possibly-stale offline snapshot. Unset PHASE6_PROD_SEQ_TSV (it is a dry-run-only offline-verification aid) and re-run." >&2
  exit 2
fi

if [ -z "${PHASE6_PROD_SEQ_TSV:-}" ]; then
  : "${PHASE6_PROD_CONN:?Set PHASE6_PROD_CONN to a direct (non-pooled) libpq connection string for production, or set PHASE6_PROD_SEQ_TSV to a captured snapshot for offline dry-run verification}"
fi

if [ -n "${PHASE6_PROD_SEQ_TSV:-}" ]; then
  DATA_SOURCE_DESC="OFFLINE SNAPSHOT file: $PHASE6_PROD_SEQ_TSV (dry-run only, NOT a live read of production)"
else
  DATA_SOURCE_DESC="LIVE query against production via psql (host resolved from PHASE6_PROD_CONN)"
fi

touch "$LOG" 2>/dev/null || true
{
  echo ""
  echo "===== RUN MARKER $(date -u +%FT%TZ) mode=$MODE pid=$$ ====="
} >> "$LOG"
log() { echo "$(date -u +%FT%TZ) $*" >> "$LOG"; }

# ssh, with local stdin forwarded to the remote command - every psql
# invocation below streams its SQL over stdin (via `docker exec -i ... psql
# ... -f -`) rather than embedding it as a shell-quoted argument, so a SQL
# body containing newlines, single quotes, or dollar-quoting ($$ ... $$ for
# DO blocks) survives the local-shell -> ssh -> remote-shell -> docker exec
# hop cleanly. The previous version of this script passed SQL as a `-tAc
# "$STRING"` argument through three layers of shell quoting, which happened
# to work only because that SQL was a single short line with no special
# characters.
ssh_pipe() {
  ssh -o BatchMode=yes -o ConnectTimeout=15 "$PHASE6_SSH_HOST" "$@"
}

is_int() { [[ "$1" =~ ^-?[0-9]+$ ]]; }
is_int_or_null() { [ "$1" = "NULL" ] || is_int "$1"; }

log "START mode=$MODE margin=$PHASE6_MARGIN container=$PHASE6_DB_CONTAINER data_source=$DATA_SOURCE_DESC"

# --- Enumeration query, shared by production, self-hosted, and the final
#     verification pass. For every non-system sequence: its own last_value
#     and max_value, plus (via pg_depend) the schema-qualified owning column
#     it is OWNED BY / backs as an IDENTITY column, and that column's
#     max(). Emits one pipe-delimited row per sequence:
#       schema|sequence|last_value|owner_column|max_owner_value|max_value
#     owner_column is '-' when the sequence is standalone (no owning
#     column); last_value and max_owner_value are the literal string NULL
#     when null. Runs as a single psql session (temp table lives for the
#     session's duration - no ON COMMIT DROP, since DO $$...$$ and the final
#     SELECT are separate implicit-autocommit statements and an ON COMMIT
#     DROP table would vanish before the SELECT ever saw it).
read -r -d '' SEQ_SQL <<'SQL'
CREATE TEMP TABLE _phase6_seq_report (
  schemaname text, sequencename text, last_value text,
  owner_column text, max_owner_val text, max_value text
);

DO $do$
DECLARE
  r RECORD;
  v_owner_schema text;
  v_owner_table text;
  v_owner_column text;
  v_maxval text;
  v_seq_oid oid;
BEGIN
  FOR r IN
    SELECT schemaname, sequencename, last_value, max_value
    FROM pg_sequences
    WHERE schemaname NOT IN ('pg_catalog','information_schema')
  LOOP
    v_owner_schema := NULL; v_owner_table := NULL; v_owner_column := NULL; v_maxval := NULL;
    v_seq_oid := format('%I.%I', r.schemaname, r.sequencename)::regclass::oid;

    SELECT tns.nspname, tc.relname, at.attname
      INTO v_owner_schema, v_owner_table, v_owner_column
    FROM pg_depend d
    JOIN pg_class tc ON tc.oid = d.refobjid
    JOIN pg_namespace tns ON tns.oid = tc.relnamespace
    JOIN pg_attribute at ON at.attrelid = tc.oid AND at.attnum = d.refobjsubid
    WHERE d.objid = v_seq_oid
      AND d.classid = 'pg_class'::regclass
      AND d.refclassid = 'pg_class'::regclass
      AND d.deptype IN ('a','i')
    LIMIT 1;

    IF v_owner_column IS NOT NULL THEN
      BEGIN
        EXECUTE format('SELECT max(%I)::text FROM %I.%I', v_owner_column, v_owner_schema, v_owner_table) INTO v_maxval;
      EXCEPTION WHEN OTHERS THEN
        v_maxval := NULL;
      END;
    END IF;

    INSERT INTO _phase6_seq_report VALUES (
      r.schemaname, r.sequencename, COALESCE(r.last_value::text,'NULL'),
      COALESCE(v_owner_column,'-'), COALESCE(v_maxval,'NULL'), r.max_value::text
    );
  END LOOP;
END
$do$;

SELECT schemaname||'|'||sequencename||'|'||last_value||'|'||owner_column||'|'||max_owner_val||'|'||max_value
FROM _phase6_seq_report
ORDER BY schemaname, sequencename;
SQL

query_prod_sequences() {
  printf '%s\n' "$SEQ_SQL" | ssh_pipe "docker exec -i $PHASE6_DB_CONTAINER psql \"$PHASE6_PROD_CONN\" -v ON_ERROR_STOP=1 -tA -f -"
}

query_self_sequences() {
  printf '%s\n' "$SEQ_SQL" | ssh_pipe "docker exec -i $PHASE6_DB_CONTAINER psql $PHASE6_SELFHOSTED_PSQL_ARGS -v ON_ERROR_STOP=1 -tA -f -"
}

# --- Preflight guard (finding: assert no subscription exists before apply) -
# apply assumes logical replication has already been dropped. A surviving
# subscription on self-hosted contradicts that assumption and is checked
# for, and hard-refused, before anything else happens. Run (and logged) in
# both modes so dry-run surfaces the same information non-fatally.
SUB_CHECK_SQL="SELECT count(*)::text FROM pg_subscription;"
SUB_COUNT_RAW=$(printf '%s\n' "$SUB_CHECK_SQL" | ssh_pipe "docker exec -i $PHASE6_DB_CONTAINER psql $PHASE6_SELFHOSTED_PSQL_ARGS -v ON_ERROR_STOP=1 -tA -f -" 2>>"$LOG")
SUB_CHECK_RC=$?
SUB_COUNT=$(printf '%s' "$SUB_COUNT_RAW" | tr -d '[:space:]')
if [ "$SUB_CHECK_RC" -ne 0 ] || ! is_int "$SUB_COUNT"; then
  echo "ERROR: preflight subscription check failed (exit=$SUB_CHECK_RC, output='$SUB_COUNT_RAW'). See $LOG." >&2
  log "FATAL preflight subscription check failed exit=$SUB_CHECK_RC output=$SUB_COUNT_RAW"
  exit 1
fi
log "Preflight: self-hosted pg_subscription count = $SUB_COUNT"
if [ "$SUB_COUNT" -gt 0 ]; then
  echo "$( [ "$MODE" = "apply" ] && echo "ERROR" || echo "WARNING" ): self-hosted has $SUB_COUNT active subscription(s). apply must only run after logical replication has been stopped." >&2
  if [ "$MODE" = "apply" ]; then
    log "FATAL preflight guard: refusing apply - $SUB_COUNT subscription(s) present on self-hosted"
    exit 1
  fi
fi

# --- 1. Enumerate production sequences dynamically -------------------------
if [ -n "${PHASE6_PROD_SEQ_TSV:-}" ]; then
  log "Reading production sequence snapshot from file: $PHASE6_PROD_SEQ_TSV (offline verification mode)"
  PROD_ROWS=$(cat "$PHASE6_PROD_SEQ_TSV")
else
  log "Querying production pg_sequences + owning-column data live via $PHASE6_DB_CONTAINER"
  PROD_ROWS=$(query_prod_sequences 2>>"$LOG")
  PROD_RC=$?
  if [ "$PROD_RC" -ne 0 ] || [ -z "$PROD_ROWS" ]; then
    echo "ERROR: failed to read production sequence data (ssh/docker exec/psql exited $PROD_RC, or returned no rows). See $LOG." >&2
    log "FATAL production enumeration failed, exit=$PROD_RC"
    exit 1
  fi
fi
PROD_COUNT=$(echo "$PROD_ROWS" | grep -c '.')
log "Production sequences enumerated: $PROD_COUNT"

# --- 2. Enumerate self-hosted sequences dynamically -------------------------
log "Querying self-hosted pg_sequences + owning-column data live via $PHASE6_DB_CONTAINER"
SELF_ROWS=$(query_self_sequences 2>>"$LOG")
SELF_RC=$?
if [ "$SELF_RC" -ne 0 ] || [ -z "$SELF_ROWS" ]; then
  echo "ERROR: failed to read self-hosted sequence data (ssh/docker exec/psql exited $SELF_RC, or returned no rows). See $LOG." >&2
  log "FATAL self-hosted enumeration failed, exit=$SELF_RC"
  exit 1
fi
SELF_COUNT=$(echo "$SELF_ROWS" | grep -c '.')
log "Self-hosted sequences enumerated: $SELF_COUNT"

# --- 3. Build lookup maps ---------------------------------------------------
declare -A PROD_LASTVAL PROD_OWNERCOL PROD_MAXOWNER PROD_MAXVALUE PROD_SEEN
declare -A SELF_LASTVAL SELF_SEEN

while IFS='|' read -r schema seq lastval ownercol maxowner maxvalue; do
  # A genuine row has BOTH a schema and a sequence name. psql echoes DDL
  # command tags (e.g. "CREATE TABLE" from the temp table this SQL builds)
  # even under -tA; those arrive as a single field and must not be parsed as
  # sequences - doing so previously produced phantom entries in the report.
  [ -z "$schema" ] && continue
  [ -z "$seq" ] && { log "IGNORED non-row output from production enumeration: $schema"; continue; }
  key="${schema}.${seq}"
  PROD_LASTVAL["$key"]="$lastval"
  PROD_OWNERCOL["$key"]="$ownercol"
  PROD_MAXOWNER["$key"]="$maxowner"
  PROD_MAXVALUE["$key"]="$maxvalue"
  PROD_SEEN["$key"]=1
done <<< "$PROD_ROWS"

while IFS='|' read -r schema seq lastval ownercol maxowner maxvalue; do
  [ -z "$schema" ] && continue
  [ -z "$seq" ] && { log "IGNORED non-row output from self-hosted enumeration: $schema"; continue; }
  key="${schema}.${seq}"
  SELF_LASTVAL["$key"]="$lastval"
  SELF_SEEN["$key"]=1
done <<< "$SELF_ROWS"

# --- 4. Walk the union of both key sets, deciding and (in apply mode) acting -
ALL_KEYS=$( { for k in "${!PROD_SEEN[@]}"; do echo "$k"; done; for k in "${!SELF_SEEN[@]}"; do echo "$k"; done; } | sort -u)

N_UPDATED=0 N_ALREADY_OK=0 N_SKIPPED_EMPTY=0 N_MISSING_SELF=0 N_MISSING_PROD=0 N_FAILED=0

printf '%-70s %-28s %-14s %-14s %s\n' "SEQUENCE" "PROD_LAST" "SELF_BEFORE" "SELF_AFTER" "ACTION"
printf '%-70s %-28s %-14s %-14s %s\n' "--------" "---------" "-----------" "----------" "------"

while IFS= read -r key; do
  [ -z "$key" ] && continue
  in_prod="${PROD_SEEN[$key]:-0}"
  in_self="${SELF_SEEN[$key]:-0}"

  if [ "$in_prod" != "1" ]; then
    printf '%-70s %-28s %-14s %-14s %s\n' "$key" "-" "${SELF_LASTVAL[$key]:-NULL}" "${SELF_LASTVAL[$key]:-NULL}" "SKIP (missing on production - self-hosted-only internal sequence)"
    log "SKIP $key: present on self-hosted only (not on production) - left untouched"
    N_MISSING_PROD=$((N_MISSING_PROD+1))
    continue
  fi

  if [ "$in_self" != "1" ]; then
    printf '%-70s %-28s %-14s %-14s %s\n' "$key" "${PROD_LASTVAL[$key]:-NULL}" "-" "-" "MISSING ON SELF-HOSTED (structural gap - see below)"
    log "MISSING_SELF $key: present on production only - table is absent from the self-hosted replica (logical replication carries no DDL)"
    N_MISSING_SELF=$((N_MISSING_SELF+1))
    continue
  fi

  pval="${PROD_LASTVAL[$key]:-NULL}"
  pcol="${PROD_OWNERCOL[$key]}"
  pmaxowner="${PROD_MAXOWNER[$key]:-NULL}"
  pmaxvalue="${PROD_MAXVALUE[$key]:-NULL}"
  sval="${SELF_LASTVAL[$key]:-NULL}"

  if ! is_int_or_null "$pval" || ! is_int_or_null "$sval" || ! is_int_or_null "$pmaxowner" || ! is_int "$pmaxvalue"; then
    printf '%-70s %-28s %-14s %-14s %s\n' "$key" "$pval" "$sval" "-" "ERROR (malformed data from psql - refusing to guess)"
    log "ERROR $key: malformed row data pval=$pval sval=$sval pmaxowner=$pmaxowner pmaxvalue=$pmaxvalue"
    N_FAILED=$((N_FAILED+1))
    continue
  fi

  has_owner=1
  [ "$pcol" = "-" ] && has_owner=0

  if [ "$has_owner" -eq 1 ]; then
    if [ "$pval" = "NULL" ] && [ "$pmaxowner" = "NULL" ]; then
      printf '%-70s %-28s %-14s %-14s %s\n' "$key" "NULL" "$sval" "$sval" "SKIP (owning column $pcol has zero rows - genuinely never used, not coerced to 0)"
      log "SKIP $key: owning column $pcol has zero rows (last_value NULL, max($pcol) NULL) - genuinely empty, not coerced to 0"
      N_SKIPPED_EMPTY=$((N_SKIPPED_EMPTY+1))
      continue
    fi
    p_lastval_or0=0; [ "$pval" != "NULL" ] && p_lastval_or0="$pval"
    p_maxowner_or0=0; [ "$pmaxowner" != "NULL" ] && p_maxowner_or0="$pmaxowner"
    if [ "$p_lastval_or0" -ge "$p_maxowner_or0" ]; then base="$p_lastval_or0"; else base="$p_maxowner_or0"; fi
    if [ "$pval" = "NULL" ]; then
      pval_display="NULL(max($pcol)=$pmaxowner)"
    else
      pval_display="$pval(max($pcol)=$pmaxowner)"
    fi
    basis_note="floor=GREATEST(last_value=$pval,max($pcol)=$pmaxowner)=$base"
  else
    if [ "$pval" = "NULL" ]; then
      printf '%-70s %-28s %-14s %-14s %s\n' "$key" "NULL" "$sval" "$sval" "SKIP (standalone sequence, production never advanced - not coerced to 0)"
      log "SKIP $key: standalone sequence (no owning column) - production last_value IS NULL, not coerced to 0"
      N_SKIPPED_EMPTY=$((N_SKIPPED_EMPTY+1))
      continue
    fi
    base="$pval"
    pval_display="$pval"
    basis_note="floor=last_value=$pval (standalone, no owning column)"
  fi

  target=$((base + PHASE6_MARGIN))

  if [ "$target" -lt 0 ] || [ "$target" -gt "$pmaxvalue" ]; then
    printf '%-70s %-28s %-14s %-14s %s\n' "$key" "$pval_display" "$sval" "-" "ERROR (target=$target out of bounds: negative or exceeds max_value=$pmaxvalue)"
    log "ERROR $key: target=$target out of bounds (negative, or > max_value=$pmaxvalue); $basis_note margin=$PHASE6_MARGIN"
    N_FAILED=$((N_FAILED+1))
    continue
  fi

  scur=0
  [ "$sval" != "NULL" ] && scur="$sval"

  if [ "$scur" -ge "$target" ]; then
    printf '%-70s %-28s %-14s %-14s %s\n' "$key" "$pval_display" "$sval" "$sval" "OK (already >= target=$target, no change - never lowered)"
    log "OK $key: self-hosted ($scur) already >= target ($target) - $basis_note - left untouched"
    N_ALREADY_OK=$((N_ALREADY_OK+1))
    continue
  fi

  if [ "$MODE" = "dry-run" ]; then
    printf '%-70s %-28s %-14s %-14s %s\n' "$key" "$pval_display" "$sval" "$target" "WOULD SET (dry-run; $basis_note; margin=$PHASE6_MARGIN)"
    log "WOULD-SET $key: self-hosted $scur -> $target ($basis_note; margin=$PHASE6_MARGIN)"
    N_UPDATED=$((N_UPDATED+1))
    continue
  fi

  # apply mode: actually setval (identifiers quoted server-side via
  # format('%I.%I', ...) rather than raw shell interpolation into SQL text),
  # then validate the returned value is a real integer >= target before
  # counting it as success - a stray psql NOTICE or non-numeric output no
  # longer passes as "SET".
  schema_lit=$(printf '%s' "$schema" | sed "s/'/''/g")
  seq_lit=$(printf '%s' "$seq" | sed "s/'/''/g")
  SETVAL_SQL="SELECT setval(format('%I.%I','${schema_lit}','${seq_lit}')::regclass, ${target}, true)::text;"
  NEWVAL_RAW=$(printf '%s\n' "$SETVAL_SQL" | ssh_pipe "docker exec -i $PHASE6_DB_CONTAINER psql $PHASE6_SELFHOSTED_PSQL_ARGS -v ON_ERROR_STOP=1 -tA -f -" 2>>"$LOG")
  SETVAL_RC=$?
  NEWVAL=$(printf '%s' "$NEWVAL_RAW" | tr -d '[:space:]')
  if [ "$SETVAL_RC" -ne 0 ] || ! is_int "$NEWVAL" || [ "$NEWVAL" -lt "$target" ]; then
    printf '%-70s %-28s %-14s %-14s %s\n' "$key" "$pval_display" "$sval" "FAILED" "ERROR (setval exit=$SETVAL_RC returned '$NEWVAL_RAW', expected integer >= $target - see log)"
    log "ERROR $key: setval to $target failed - exit=$SETVAL_RC returned='$NEWVAL_RAW'"
    N_FAILED=$((N_FAILED+1))
    continue
  fi
  printf '%-70s %-28s %-14s %-14s %s\n' "$key" "$pval_display" "$sval" "$NEWVAL" "SET"
  log "SET $key: self-hosted $scur -> $NEWVAL (target was $target; $basis_note; margin=$PHASE6_MARGIN)"
  N_UPDATED=$((N_UPDATED+1))
done <<< "$ALL_KEYS"

# --- 5. Final independent verification pass ---------------------------------
# Re-reads BOTH sides fresh (independent of everything computed above) and
# asserts, for every sequence present on both sides, that self-hosted's
# current value is at or above production's true floor - GREATEST(last_value,
# max(owning column)), margin NOT included. The margin is a cutover-window
# safety cushion on top of the floor, not part of the correctness floor
# itself, so leaving it out of this assertion keeps the check meaningful even
# under PHASE6_MARGIN=0. This is the line the runbook should actually treat
# as proof the step succeeded.
echo
echo "Final independent verification pass (re-reading both sides fresh):"
log "Starting final independent verification pass"

if [ -n "${PHASE6_PROD_SEQ_TSV:-}" ]; then
  FPROD_ROWS="$PROD_ROWS"
  log "Final verification pass reusing the offline snapshot (PHASE6_PROD_SEQ_TSV set) - not a fresh read of production"
else
  FPROD_ROWS=$(query_prod_sequences 2>>"$LOG")
  FPROD_RC=$?
  if [ "$FPROD_RC" -ne 0 ] || [ -z "$FPROD_ROWS" ]; then
    echo "ERROR: final verification pass failed to re-read production (exit=$FPROD_RC). See $LOG." >&2
    log "FATAL final verification pass: production re-read failed exit=$FPROD_RC"
    FPROD_ROWS=""
  fi
fi
FSELF_ROWS=$(query_self_sequences 2>>"$LOG")
FSELF_RC=$?
if [ "$FSELF_RC" -ne 0 ] || [ -z "$FSELF_ROWS" ]; then
  echo "ERROR: final verification pass failed to re-read self-hosted (exit=$FSELF_RC). See $LOG." >&2
  log "FATAL final verification pass: self-hosted re-read failed exit=$FSELF_RC"
  FSELF_ROWS=""
fi

declare -A FPROD_LASTVAL FPROD_MAXOWNER FPROD_SEEN
declare -A FSELF_LASTVAL FSELF_SEEN

while IFS='|' read -r schema seq lastval ownercol maxowner maxvalue; do
  [ -z "$schema" ] && continue
  key="${schema}.${seq}"
  FPROD_LASTVAL["$key"]="$lastval"
  FPROD_MAXOWNER["$key"]="$maxowner"
  FPROD_SEEN["$key"]=1
done <<< "$FPROD_ROWS"

while IFS='|' read -r schema seq lastval ownercol maxowner maxvalue; do
  [ -z "$schema" ] && continue
  key="${schema}.${seq}"
  FSELF_LASTVAL["$key"]="$lastval"
  FSELF_SEEN["$key"]=1
done <<< "$FSELF_ROWS"

N_VERIFY_OK=0 N_VERIFY_FAIL=0 N_VERIFY_SKIPPED=0
for key in "${!FPROD_SEEN[@]}"; do
  [ "${FSELF_SEEN[$key]:-0}" = "1" ] || continue
  fpval="${FPROD_LASTVAL[$key]}"
  fpmax="${FPROD_MAXOWNER[$key]}"
  fsval="${FSELF_LASTVAL[$key]}"
  if ! is_int_or_null "$fpval" || ! is_int_or_null "$fpmax" || ! is_int_or_null "$fsval"; then
    N_VERIFY_SKIPPED=$((N_VERIFY_SKIPPED+1))
    log "VERIFY-SKIP $key: malformed data on re-read"
    continue
  fi
  fp0=0; [ "$fpval" != "NULL" ] && fp0="$fpval"
  fm0=0; [ "$fpmax" != "NULL" ] && fm0="$fpmax"
  if [ "$fp0" -ge "$fm0" ]; then floor="$fp0"; else floor="$fm0"; fi
  fs0=0; [ "$fsval" != "NULL" ] && fs0="$fsval"
  if [ "$fs0" -ge "$floor" ]; then
    N_VERIFY_OK=$((N_VERIFY_OK+1))
    log "VERIFY-OK $key: self-hosted ($fs0) >= production floor ($floor)"
  else
    N_VERIFY_FAIL=$((N_VERIFY_FAIL+1))
    echo "  VERIFY FAIL: $key self-hosted=$fs0 < production floor=$floor" >&2
    log "VERIFY-FAIL $key: self-hosted ($fs0) < production floor ($floor)"
  fi
done

VERIFY_TOTAL=$((N_VERIFY_OK + N_VERIFY_FAIL))
if [ "$N_VERIFY_FAIL" -eq 0 ] && [ "$N_VERIFY_SKIPPED" -eq 0 ] && [ "$VERIFY_TOTAL" -gt 0 ]; then
  VERIFY_STATUS="PASS"
else
  VERIFY_STATUS="FAIL"
fi
if [ "$MODE" = "dry-run" ]; then
  VERIFY_TAIL="(dry-run: informational only - self-hosted has not been modified yet; mismatches above are expected until apply runs and do not affect this run's exit status)"
else
  VERIFY_TAIL="(apply mode: this assertion holding is the proof the cutover step succeeded)"
fi
echo "FINAL VERIFICATION: $VERIFY_STATUS - self-hosted >= production floor for $N_VERIFY_OK/$VERIFY_TOTAL shared sequences (fail=$N_VERIFY_FAIL, skipped=$N_VERIFY_SKIPPED) $VERIFY_TAIL"
log "FINAL VERIFICATION: $VERIFY_STATUS ok=$N_VERIFY_OK fail=$N_VERIFY_FAIL skipped=$N_VERIFY_SKIPPED total=$VERIFY_TOTAL mode=$MODE"

echo
echo "Summary (mode=$MODE, margin=$PHASE6_MARGIN):"
echo "  production data source:                  $DATA_SOURCE_DESC"
echo "  production sequences enumerated:        $PROD_COUNT"
echo "  self-hosted sequences enumerated:        $SELF_COUNT"
echo "  updated / would-update:                  $N_UPDATED"
echo "  already >= target (no change needed):    $N_ALREADY_OK"
echo "  skipped - genuinely never used (0 rows): $N_SKIPPED_EMPTY"
echo "  MISSING ON SELF-HOSTED (structural gap): $N_MISSING_SELF"
echo "  skipped - missing on production:          $N_MISSING_PROD"
echo "  failed:                                  $N_FAILED"
echo "See $LOG for the full run log."

log "DONE updated=$N_UPDATED ok=$N_ALREADY_OK skipped_empty=$N_SKIPPED_EMPTY missing_self=$N_MISSING_SELF missing_prod=$N_MISSING_PROD failed=$N_FAILED verify=$VERIFY_STATUS"

# --- 6. Final exit status ----------------------------------------------------
# Non-zero if: any per-sequence failure, OR a production-only table missing
# from self-hosted (finding: this must be a hard failure - logical
# replication carries no DDL, so this is the loudest available signal the
# replica is structurally incomplete), OR, in apply mode, the final
# verification pass did not cleanly pass.
EXIT_OK=1
[ "$N_FAILED" -gt 0 ] && EXIT_OK=0
[ "$N_MISSING_SELF" -gt 0 ] && EXIT_OK=0
if [ "$MODE" = "apply" ] && [ "$VERIFY_STATUS" != "PASS" ]; then EXIT_OK=0; fi

if [ "$EXIT_OK" -eq 1 ]; then
  exit 0
else
  exit 1
fi
