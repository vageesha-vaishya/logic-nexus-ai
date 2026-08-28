#!/bin/bash
# Phase 3: syncs Storage object bytes from production to self-hosted via
# each side's Storage HTTP API. Idempotent (re-uploading overwrites) - this
# same script is what gets re-run just before Phase 6's cutover to catch
# anything uploaded to production in the interim.
#
# Required env vars:
#   PHASE3_PROD_SERVICE_ROLE_KEY  - production's service_role JWT (Storage API auth)
#   PHASE3_SELFHOSTED_SERVICE_ROLE_KEY - self-hosted's service_role JWT (Storage API auth)
#   PHASE3_PROD_PG_CONN           - production's direct (non-pooled) postgres-role
#                                   connection string (used only to list
#                                   storage.objects rows). DO NOT use env's
#                                   DIRECT_URL / DATABASE_URL / SUPABASE_DB_URL
#                                   verbatim - despite their names, all three
#                                   are actually a POOLED pgbouncer connection
#                                   (aws-1-ap-south-1.pooler.supabase.com:6543,
#                                   pgbouncer=true), which `psql` rejects and
#                                   which this script's `docker exec psql`
#                                   invocation can't use anyway. Use the true
#                                   direct host instead, e.g.:
#                                     postgresql://postgres:<password from
#                                     env's DIRECT_URL>@db.gzhxgoigflftharcmdqj
#                                     .supabase.co:5432/postgres?sslmode=require
#                                   (same host Phase 2 verified - see
#                                   PHASE2_PROD_CONN in README.md)
#   PHASE3_SSH_HOST               - SSH alias for the VPS
#   PHASE3_DB_CONTAINER           - self-hosted Postgres container name (only
#                                   used to run the listing query through the
#                                   same already-configured psql client that
#                                   container has; no self-hosted DB write)
set -uo pipefail

: "${PHASE3_PROD_SERVICE_ROLE_KEY:?Set PHASE3_PROD_SERVICE_ROLE_KEY}"
: "${PHASE3_SELFHOSTED_SERVICE_ROLE_KEY:?Set PHASE3_SELFHOSTED_SERVICE_ROLE_KEY}"
: "${PHASE3_PROD_PG_CONN:?Set PHASE3_PROD_PG_CONN}"
: "${PHASE3_SSH_HOST:?Set PHASE3_SSH_HOST}"
: "${PHASE3_DB_CONTAINER:?Set PHASE3_DB_CONTAINER}"

PROD_URL="https://gzhxgoigflftharcmdqj.supabase.co"
SELFHOSTED_URL="https://supabase.sosservices.online"
# Relative to whatever directory this script is invoked from (e.g. the repo
# root if run as `bash deploy/selfhosted-supabase/scripts/phase3-storage-sync.sh`).
LOG="./phase3-storage-sync.log"
: > "$LOG"

# List every real object (bucket_id, name, content-type) directly from
# production's storage.objects - simpler and more reliable than paginating
# the Storage API's list endpoint, and we already have DB read access.
OBJECTS=$(ssh -n -o BatchMode=yes -o ConnectTimeout=8 "$PHASE3_SSH_HOST" \
  "docker exec $PHASE3_DB_CONTAINER psql \"$PHASE3_PROD_PG_CONN\" -tAc \
  \"SELECT bucket_id || '|' || name || '|' || coalesce(metadata->>'mimetype','application/octet-stream') FROM storage.objects ORDER BY bucket_id, name;\"")
LIST_EXIT=$?
# This is a command substitution assignment, not a pipeline - `set -o
# pipefail` does NOT catch a failure here, so it must be checked explicitly.
# Without this, a bad SSH_HOST/DB_CONTAINER/PROD_PG_CONN just yields an empty
# $OBJECTS, which silently looks identical to "production genuinely has zero
# objects" further down.
if [ "$LIST_EXIT" -ne 0 ]; then
  echo "ERROR: failed to list production storage.objects (ssh/docker exec/psql exited $LIST_EXIT)." >&2
  echo "Check PHASE3_SSH_HOST, PHASE3_DB_CONTAINER, and PHASE3_PROD_PG_CONN - see this script's header comment." >&2
  exit 1
fi

TOTAL=$(echo "$OBJECTS" | grep -c . || true)
if [ "$TOTAL" -eq 0 ]; then
  echo "ERROR: listing query succeeded but returned 0 rows from production storage.objects." >&2
  echo "Refusing to report success - this almost certainly means the query/connection is misconfigured, not that production genuinely has zero objects. Check PHASE3_PROD_PG_CONN, PHASE3_SSH_HOST, and PHASE3_DB_CONTAINER." >&2
  exit 1
fi
# DONE is used below purely for the [$DONE/$TOTAL] progress label in each log
# line - it survives fine across iterations since the whole while-loop runs
# in one persistent subshell. There's no OK/FAIL running-total counter here
# because those would NOT survive past the loop (the subshell exits when the
# pipe closes) - the real OK/FAIL tallies are grep'd out of the log below.
DONE=0
echo "$(date -u) START total=$TOTAL" >> "$LOG"

echo "$OBJECTS" | while IFS='|' read -r BUCKET NAME MIMETYPE; do
  [ -z "$BUCKET" ] && continue
  DONE=$((DONE+1))
  TMPFILE=$(mktemp)

  HTTP_CODE=$(curl -s -o "$TMPFILE" -w '%{http_code}' \
    -H "Authorization: Bearer $PHASE3_PROD_SERVICE_ROLE_KEY" \
    -H "apikey: $PHASE3_PROD_SERVICE_ROLE_KEY" \
    "$PROD_URL/storage/v1/object/$BUCKET/$NAME")
  if [ "$HTTP_CODE" != "200" ]; then
    echo "$(date -u) [$DONE/$TOTAL] FAIL(download:$HTTP_CODE) $BUCKET/$NAME" >> "$LOG"
    rm -f "$TMPFILE"; continue
  fi

  UPLOAD_CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
    -H "Authorization: Bearer $PHASE3_SELFHOSTED_SERVICE_ROLE_KEY" \
    -H "apikey: $PHASE3_SELFHOSTED_SERVICE_ROLE_KEY" \
    -H "Content-Type: $MIMETYPE" \
    -H "x-upsert: true" \
    --data-binary "@$TMPFILE" \
    "$SELFHOSTED_URL/storage/v1/object/$BUCKET/$NAME")
  if [ "$UPLOAD_CODE" == "200" ]; then
    echo "$(date -u) [$DONE/$TOTAL] OK $BUCKET/$NAME" >> "$LOG"
  else
    echo "$(date -u) [$DONE/$TOTAL] FAIL(upload:$UPLOAD_CODE) $BUCKET/$NAME" >> "$LOG"
  fi
  rm -f "$TMPFILE"
done

echo "$(date -u) DONE total=$TOTAL" >> "$LOG"
echo "See $LOG for per-object results (tally below is grep'd from the log, not a live counter)."
OK_COUNT=$(grep -c ' OK ' "$LOG" || true)
FAIL_COUNT=$(grep -c ' FAIL' "$LOG" || true)
echo "OK: $OK_COUNT"
echo "FAIL: $FAIL_COUNT"
if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "ERROR: $FAIL_COUNT object(s) failed to sync - see $LOG for details." >&2
  exit 1
fi
