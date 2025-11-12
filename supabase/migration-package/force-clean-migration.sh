#!/bin/bash

# Force Clean Migration
# Automatically cleans and recreates database without prompts
# USE WITH CAUTION: This will delete all existing data!

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "=========================================="
echo "  FORCE CLEAN MIGRATION"
echo "  WARNING: This will DELETE ALL DATA"
echo "=========================================="
echo ""

DIAGNOSE_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --diagnose-only|-d) DIAGNOSE_ONLY=1 ;;
  esac
done

diagnose_error() {
  local msg="$1"
  if echo "$msg" | grep -qi "password authentication failed"; then echo "Parameter: password appears incorrect"; return; fi
  if echo "$msg" | grep -qi "database .* does not exist"; then echo "Parameter: database name is invalid"; return; fi
  if echo "$msg" | grep -qi "role .* does not exist"; then echo "Parameter: username is invalid"; return; fi
  if echo "$msg" | grep -qi "could not translate host name\|Name or service not known"; then echo "Parameter: host is invalid or DNS blocked"; return; fi
  if echo "$msg" | grep -qi "Connection refused"; then echo "Parameter: port blocked or service not listening"; return; fi
  if echo "$msg" | grep -qi "Connection timed out\|Operation timed out"; then echo "Parameter: network blocked or firewall"; return; fi
  if echo "$msg" | grep -qi "certificate\|ssl"; then echo "Parameter: SSL/TLS negotiation problem"; return; fi
  echo "Unknown authentication error"
}

if [ "$DIAGNOSE_ONLY" -eq 0 ]; then
  read -p "Type 'DELETE ALL DATA' to continue: " confirm
  if [ "$confirm" != "DELETE ALL DATA" ]; then
      echo -e "${RED}Aborted.${NC}"
      exit 1
  fi
fi

echo ""
if [ "$DIAGNOSE_ONLY" -eq 1 ]; then
  echo -e "${YELLOW}Starting diagnosis...${NC}"
else
  echo -e "${YELLOW}Starting force clean migration...${NC}"
fi

# Load configuration early
source new-supabase-config.env

# Show target host and credentials info
DB_HOST=$(echo "$NEW_DB_URL" | sed -E 's#.*@([^:/?]+).*#\1#')
DB_NAME=$(echo "$NEW_DB_URL" | sed -E 's#.*/([^?]+).*#\1#')
DB_PASS=$(echo "$NEW_DB_URL" | sed -E 's#postgresql://postgres:([^@]+)@.*#\1#')
DB_USER="postgres"

echo -e "${GREEN}Target Configuration:${NC}"
echo -e "  Host: $DB_HOST"
echo -e "  Database: $DB_NAME"
echo -e "  User: $DB_USER"
echo -e "  Password: ${DB_PASS:0:4}****${DB_PASS: -4}"
echo ""

EXPECTED_HOST="db.${NEW_PROJECT_ID}.supabase.co"
if [ -n "$NEW_PROJECT_ID" ] && [ "$DB_HOST" != "$EXPECTED_HOST" ]; then
  echo -e "${YELLOW}Parameter check:${NC} Host does not match project id (expected: $EXPECTED_HOST)"
fi
if [ "$DB_NAME" != "postgres" ]; then
  echo -e "${YELLOW}Parameter check:${NC} Database name is '$DB_NAME' (expected: 'postgres')"
fi
USE_PGPASS=0
case "$DB_PASS" in
  "*[@/:?#&%]*")
    echo -e "${YELLOW}Parameter check:${NC} Password contains special characters; enabling safe authentication"
    USE_PGPASS=1
  ;;
esac

DNS_OK=0
echo -e "${YELLOW}[1/3] Testing DNS resolution...${NC}"
if ! nslookup "$DB_HOST" >/dev/null 2>&1; then
  echo -e "${RED}✗ DNS resolution failed for '$DB_HOST'${NC}"
  echo -e "${YELLOW}Troubleshooting steps:${NC}"
  echo -e "  1. Disable VPN and try again"
  echo -e "  2. Flush DNS cache (macOS: sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder)"
  echo -e "  3. Try using public DNS (1.1.1.1 or 8.8.8.8)"
  echo -e "  4. Check if you can access: https://$DB_HOST"
  if [ "$DIAGNOSE_ONLY" -eq 0 ]; then
    exit 1
  fi
else
  DNS_OK=1
  echo -e "${GREEN}✓ DNS resolution successful${NC}"
fi

echo -e "${YELLOW}[2/3] Testing network connectivity...${NC}"
PROBE_5432=0
PROBE_6543=0
if nc -z -w8 "$DB_HOST" 5432 2>/dev/null; then PROBE_5432=1; fi
if nc -z -w8 "$DB_HOST" 6543 2>/dev/null; then PROBE_6543=1; fi
if [ "$PROBE_5432" -eq 1 ] || [ "$PROBE_6543" -eq 1 ]; then
  echo -e "${GREEN}✓ Network connectivity successful${NC}"
else
  echo -e "${YELLOW}! Network port probe failed (5432/6543) — continuing to auth test${NC}"
  echo -e "${YELLOW}  Note:${NC} Some environments block port scans (nc). We'll try psql next."
fi

# Database authentication check (SSL required)
echo -e "${YELLOW}[3/3] Testing database authentication...${NC}"

encode_pw() { printf '%s' "$1" | sed -e 's/%/%25/g' -e 's/@/%40/g' -e 's/:/%3A/g' -e 's=/=%2F=g' -e 's/\?/%3F/g' -e 's/#/%23/g' -e 's/&/%26/g'; }
ENC_PASS=$(encode_pw "$DB_PASS")
DB_URI_5432="postgresql://postgres:${ENC_PASS}@${DB_HOST}:5432/${DB_NAME}?sslmode=require&connect_timeout=10"
DB_URI_6543="postgresql://postgres:${ENC_PASS}@${DB_HOST}:6543/${DB_NAME}?sslmode=require&connect_timeout=10"

if [ "$USE_PGPASS" -eq 1 ]; then
  AUTH_OUT_5432=$(PGPASSWORD="$DB_PASS" PGSSLMODE="require" psql -h "$DB_HOST" -p 5432 -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" --connect-timeout=10 2>&1 >/dev/null)
else
  AUTH_OUT_5432=$(psql "$DB_URI_5432" -c "SELECT 1" 2>&1 >/dev/null)
fi
AUTH_CODE_5432=$?
AUTH_CODE_6543=1
if [ "$AUTH_CODE_5432" -ne 0 ]; then
  echo -e "${YELLOW}Direct connection (5432) failed; trying pooling (6543)...${NC}"
  if [ "$USE_PGPASS" -eq 1 ]; then
    AUTH_OUT_6543=$(PGPASSWORD="$DB_PASS" PGSSLMODE="require" psql -h "$DB_HOST" -p 6543 -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" --connect-timeout=10 2>&1 >/dev/null)
  else
    AUTH_OUT_6543=$(psql "$DB_URI_6543" -c "SELECT 1" 2>&1 >/dev/null)
  fi
  AUTH_CODE_6543=$?
  if [ "$AUTH_CODE_6543" -eq 0 ]; then
    if [ "$USE_PGPASS" -eq 1 ]; then
      export NEW_DB_URL="postgresql://postgres:${ENC_PASS}@${DB_HOST}:6543/${DB_NAME}?sslmode=require&connect_timeout=10"
    else
      export NEW_DB_URL="$DB_URI_6543"
    fi
    echo -e "${GREEN}✓ Using pooling port 6543 for migration${NC}"
  else
    echo -e "${RED}✗ Authentication failed on both ports${NC}"
    ISSUE_5432=$(diagnose_error "$AUTH_OUT_5432")
    ISSUE_6543=$(diagnose_error "$AUTH_OUT_6543")
    echo -e "${YELLOW}Detected on 5432:${NC} $ISSUE_5432"
    echo -e "${YELLOW}Detected on 6543:${NC} $ISSUE_6543"
    echo -e "${YELLOW}Troubleshooting steps:${NC}"
    echo -e "  1. Verify password in new-supabase-config.env is correct"
    echo -e "  2. Check database connection string in Supabase dashboard:"
    echo -e "     Project Settings → Database → Connection String"
    echo -e "  3. Ensure no extra spaces or special characters in password"
    echo -e "  4. Verify database is not paused or deleted"
    echo -e "  5. Check if IP is whitelisted (if IP restrictions enabled)"
    echo ""
    echo -e "${YELLOW}Current connection string format:${NC}"
    echo -e "  postgresql://postgres:[PASSWORD]@$DB_HOST:5432/$DB_NAME?sslmode=require"
    exit 1
  fi
else
  if [ "$USE_PGPASS" -eq 1 ]; then
    export NEW_DB_URL="postgresql://postgres:${ENC_PASS}@${DB_HOST}:5432/${DB_NAME}?sslmode=require&connect_timeout=10"
  else
    export NEW_DB_URL="$DB_URI_5432"
  fi
echo -e "${GREEN}✓ Direct connection successful (5432)${NC}"
fi
echo ""

if [ "$DIAGNOSE_ONLY" -eq 1 ]; then
  echo ""
  echo "=========================================="
  echo "  Diagnosis Summary"
  echo "=========================================="
  echo "Host: $DB_HOST"
  echo "Project Match: $( [ -n "$NEW_PROJECT_ID" ] && [ "$DB_HOST" = "db.${NEW_PROJECT_ID}.supabase.co" ] && echo yes || echo no )"
  echo "Database: $DB_NAME"
  echo "User: $DB_USER"
  echo "DNS: $( [ "$DNS_OK" -eq 1 ] && echo pass || echo fail )"
  echo "Probe 5432: $( [ "$PROBE_5432" -eq 1 ] && echo open || echo blocked )"
  echo "Probe 6543: $( [ "$PROBE_6543" -eq 1 ] && echo open || echo blocked )"
  echo "Auth 5432: $( [ "$AUTH_CODE_5432" -eq 0 ] && echo pass || echo fail )"
  echo "Auth 6543: $( [ "$AUTH_CODE_6543" -eq 0 ] && echo pass || echo fail )"
  echo "SSL Path: $( [ "$USE_PGPASS" -eq 1 ] && echo 'PGPASSWORD + PGSSLMODE=require' || echo 'URI sslmode=require' )"
  echo "=========================================="
  if [ "$AUTH_CODE_5432" -eq 0 ] || [ "$AUTH_CODE_6543" -eq 0 ]; then
    echo -e "${GREEN}Diagnosis complete: authentication succeeded${NC}"
    exit 0
  else
    echo -e "${RED}Diagnosis complete: authentication failed${NC}"
    exit 1
  fi
fi

# Step 1: Cleanup
echo ""
echo -e "${GREEN}[1/4] Cleaning existing database...${NC}"
bash 02-cleanup-existing.sh

# Step 2: Apply schema
echo ""
echo -e "${GREEN}[2/4] Applying fresh schema...${NC}"
if [ "$USE_PGPASS" -eq 1 ]; then
  PORT=$(echo "$NEW_DB_URL" | sed -E 's#.*:([0-9]+)/.*#\1#')
  PGPASSWORD="$DB_PASS" PGSSLMODE="require" psql -h "$DB_HOST" -p "$PORT" -U "$DB_USER" -d "$DB_NAME" -f "../schema-export.sql"
else
  psql "$NEW_DB_URL" -f "../schema-export.sql"
fi

# Step 3: Import data
echo ""
echo -e "${GREEN}[3/4] Importing data...${NC}"
bash 03-import-data.sh

# Step 4: Verify
echo ""
echo -e "${GREEN}[4/4] Verifying migration...${NC}"
bash verify-migration.sh

echo ""
echo -e "${GREEN}=========================================="
echo "✓ FORCE CLEAN MIGRATION COMPLETED"
echo "==========================================${NC}"
echo ""
