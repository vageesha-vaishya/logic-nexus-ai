#!/usr/bin/env bash
set -euo pipefail

# Auto-resolve Supabase DB host to IP and run importer
# - Tries dig, nslookup, Google DoH, Cloudflare DoH
# - Sets DB_HOSTADDR_OVERRIDE for importer to bypass DNS

cd "$(dirname "$0")/.."  # move to migration-package root

PRESET_DB_HOSTADDR_OVERRIDE="${DB_HOSTADDR_OVERRIDE:-}"
set -a
source ./new-supabase-config.env
set +a
# Respect preset override if provided externally
if [ -n "$PRESET_DB_HOSTADDR_OVERRIDE" ]; then
  export DB_HOSTADDR_OVERRIDE="$PRESET_DB_HOSTADDR_OVERRIDE"
fi

log() { echo "[resolve-import] $*"; }

# Extract DB host from NEW_DB_URL
DB_HOST="$(echo "$NEW_DB_URL" | sed -nE 's#^postgresql://[^@]+@([^:/]+).*#\1#p')"
if [ -z "$DB_HOST" ]; then
  echo "ERROR: Could not extract DB host from NEW_DB_URL" >&2
  exit 1
fi

log "Project DB host: $DB_HOST"

RESOLVED_IP="${DB_HOSTADDR_OVERRIDE:-}"

try_resolve() {
  local host="$1"
  local ip=""
  # dig
  if command -v dig >/dev/null 2>&1; then
    ip="$(dig +short A "$host" | grep -E "^([0-9]{1,3}\.){3}[0-9]{1,3}$" | head -n1 || true)"
    [ -n "$ip" ] && echo "$ip" && return 0
    # Try AAAA for IPv6
    ip="$(dig +short AAAA "$host" | head -n1 || true)"
    [ -n "$ip" ] && echo "$ip" && return 0
  fi
  # nslookup
  if command -v nslookup >/dev/null 2>&1; then
    # Only capture the Address following the queried Name, not the DNS server Address
    ip="$(nslookup "$host" 2>/dev/null | awk '/^Name:/{f=1;next} f && /^Address:/{print $2; exit}' || true)"
    [ -n "$ip" ] && echo "$ip" && return 0
  fi
  # host (handles AAAA nicely)
  if command -v host >/dev/null 2>&1; then
    ip="$(host "$host" 2>/dev/null | awk '/has IPv6 address/{print $NF; exit}' || true)"
    [ -n "$ip" ] && echo "$ip" && return 0
    ip="$(host "$host" 2>/dev/null | awk '/has address/{print $NF; exit}' || true)"
    [ -n "$ip" ] && echo "$ip" && return 0
  fi
  # Google DoH
  if command -v curl >/dev/null 2>&1; then
    ip="$(curl -s "https://dns.google/resolve?name=${host}&type=A" | grep -oE '"data":"[0-9\.]+"' | head -n1 | sed -E 's/"data":"([0-9\.]+)"/\1/' || true)"
    [ -n "$ip" ] && echo "$ip" && return 0
    # Cloudflare DoH
    ip="$(curl -s -H 'accept: application/dns-json' "https://cloudflare-dns.com/dns-query?name=${host}&type=A" | grep -oE '"data":"[0-9\.]+"' | head -n1 | sed -E 's/"data":"([0-9\.]+)"/\1/' || true)"
    [ -n "$ip" ] && echo "$ip" && return 0
    # Google DoH AAAA
    ip="$(curl -s "https://dns.google/resolve?name=${host}&type=AAAA" | grep -oE '"data":"[0-9a-fA-F:\\]+"' | head -n1 | sed -E 's/"data":"([0-9a-fA-F:\\]+)"/\1/' || true)"
    [ -n "$ip" ] && echo "$ip" && return 0
    # Cloudflare DoH AAAA
    ip="$(curl -s -H 'accept: application/dns-json' "https://cloudflare-dns.com/dns-query?name=${host}&type=AAAA" | grep -oE '"data":"[0-9a-fA-F:\\]+"' | head -n1 | sed -E 's/"data":"([0-9a-fA-F:\\]+)"/\1/' || true)"
    [ -n "$ip" ] && echo "$ip" && return 0
  fi
  return 1
}

if [ -z "$RESOLVED_IP" ]; then
  log "Resolving $DB_HOST to IP..."
  if ! RESOLVED_IP="$(try_resolve "$DB_HOST")"; then
    echo "ERROR: Could not resolve IP for $DB_HOST via dig/nslookup/DoH." >&2
    echo "Hint: Try on a different network or set DB_HOSTADDR_OVERRIDE in new-supabase-config.env." >&2
    exit 2
  fi
fi

# Avoid common DNS server IPs accidentally captured
case "$RESOLVED_IP" in
  1.1.1.1|8.8.8.8|9.9.9.9)
    echo "ERROR: Resolver returned DNS server IP ($RESOLVED_IP), not the DB host." >&2
    echo "Please try on a different network or set DB_HOSTADDR_OVERRIDE manually." >&2
    exit 2
    ;;
esac

log "Using hostaddr=$RESOLVED_IP"
export DB_HOSTADDR_OVERRIDE="$RESOLVED_IP"

# Sanity check connection (will append hostaddr automatically in importer)
if ! psql "$NEW_DB_URL&hostaddr=$DB_HOSTADDR_OVERRIDE" -c "SELECT 1" >/dev/null 2>&1; then
  echo "WARNING: Connection probe failed; proceeding to importer which also applies fallback." >&2
fi

# Run restricted import (auth.users + profiles) or whatever IMPORT_ONLY_TABLES is set to
bash ./03-import-data.sh