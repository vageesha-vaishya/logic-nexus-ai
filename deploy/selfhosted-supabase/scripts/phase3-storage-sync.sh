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
#                                   connection string, e.g. env's DIRECT_URL
#                                   (used only to list storage.objects rows)
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
LOG="./phase3-storage-sync.log"
: > "$LOG"

# List every real object (bucket_id, name, content-type) directly from
# production's storage.objects - simpler and more reliable than paginating
# the Storage API's list endpoint, and we already have DB read access.
OBJECTS=$(ssh -n -o BatchMode=yes -o ConnectTimeout=8 "$PHASE3_SSH_HOST" \
  "docker exec $PHASE3_DB_CONTAINER psql \"$PHASE3_PROD_PG_CONN\" -tAc \
  \"SELECT bucket_id || '|' || name || '|' || coalesce(metadata->>'mimetype','application/octet-stream') FROM storage.objects ORDER BY bucket_id, name;\"")

TOTAL=$(echo "$OBJECTS" | grep -c . || true)
DONE=0; OK=0; FAIL=0
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
    FAIL=$((FAIL+1)); rm -f "$TMPFILE"; continue
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
    OK=$((OK+1))
  else
    echo "$(date -u) [$DONE/$TOTAL] FAIL(upload:$UPLOAD_CODE) $BUCKET/$NAME" >> "$LOG"
    FAIL=$((FAIL+1))
  fi
  rm -f "$TMPFILE"
done

echo "$(date -u) DONE total=$TOTAL" >> "$LOG"
echo "See $LOG for per-object results (the while-loop's OK/FAIL counters don't survive the pipe subshell - grep the log for the real tally)."
grep -c ' OK ' "$LOG" || true
grep -c 'FAIL' "$LOG" || true
