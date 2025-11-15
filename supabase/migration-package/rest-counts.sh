#!/usr/bin/env bash
set -euo pipefail

# Change to this script's directory to ensure relative paths resolve
cd "$(dirname "$0")"

# Load Supabase config
set -a
source ./new-supabase-config.env
set +a

API="${NEW_SUPABASE_URL}/rest/v1"
KEY="${NEW_SUPABASE_SERVICE_ROLE_KEY:-}"; if [ -z "$KEY" ]; then KEY="${NEW_SUPABASE_ANON_KEY}"; fi

count_json() {
  local tbl="$1"
  curl -s "${API}/${tbl}?select=count" \
    -H "apikey: ${KEY}" \
    -H "Authorization: Bearer ${KEY}" \
    -H "Accept-Profile: public" \
    -H "Prefer: count=exact"
}

status_code() {
  local tbl="$1"
  curl -s -o /dev/null -w "%{http_code}" "${API}/${tbl}?select=count" \
    -H "apikey: ${KEY}" \
    -H "Authorization: Bearer ${KEY}" \
    -H "Accept-Profile: public" \
    -H "Prefer: count=exact"
}

tables=(tenants franchises accounts contacts leads opportunities quotes quote_items activities)

echo "{"
for i in "${!tables[@]}"; do
  t="${tables[$i]}"
  s="$(status_code "$t")"
  b="$(count_json "$t")"
  # Extract count from JSON array: [{"count": N}]
  c="$(echo "$b" | grep -o '"count"[[:space:]]*:[[:space:]]*[0-9]\+' | awk -F ':' '{print $2}' | tr -d ' ')"
  [ -z "$c" ] && c="null"
  comma=","; [ "$i" -eq $(( ${#tables[@]} - 1 )) ] && comma=""
  echo "  \"$t\": {\"status\": $s, \"count\": $c}$comma"
done
echo "}"