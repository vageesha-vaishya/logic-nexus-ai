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

# Final confirmation
read -p "Type 'DELETE ALL DATA' to continue: " confirm

if [ "$confirm" != "DELETE ALL DATA" ]; then
    echo -e "${RED}Aborted.${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Starting force clean migration...${NC}"

# Load configuration early
source new-supabase-config.env

# Show target host
DB_HOST=$(echo "$NEW_DB_URL" | sed -E 's#.*@([^:/?]+).*#\1#')
echo -e "${GREEN}Target DB Host:${NC} $DB_HOST"

# Quick connectivity check
if ! nslookup "$DB_HOST" >/dev/null 2>&1; then
  echo -e "${RED}DNS resolution failed for '$DB_HOST'.${NC}"
  echo -e "${YELLOW}Hints:${NC} Disable VPN, flush DNS (macOS: sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder), or set DNS to 1.1.1.1."
  exit 1
fi

# Try connection (5432), fallback to pooling (6543) and update NEW_DB_URL
DB_NAME=$(echo "$NEW_DB_URL" | sed -E 's#.*/([^?]+).*#\1#')
DB_PASS=$(echo "$NEW_DB_URL" | sed -E 's#postgresql://postgres:([^@]+)@.*#\1#')
if ! PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p 5432 -U postgres -d "$DB_NAME" -c "SELECT 1" >/dev/null 2>&1; then
  echo -e "${YELLOW}Direct connection (5432) failed; trying pooling (6543).${NC}"
  if PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p 6543 -U postgres -d "$DB_NAME" -c "SELECT 1" >/dev/null 2>&1; then
    export NEW_DB_URL="postgresql://postgres:${DB_PASS}@${DB_HOST}:6543/${DB_NAME}?sslmode=require"
    echo -e "${GREEN}Using pooling port 6543 for migration.${NC}"
  else
    echo -e "${RED}Cannot connect on 5432 or 6543. Check credentials, firewall, and network.${NC}"
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
psql "$NEW_DB_URL" -f "../schema-export.sql"

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
