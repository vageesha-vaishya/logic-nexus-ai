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

# DNS connectivity check
echo -e "${YELLOW}[1/3] Testing DNS resolution...${NC}"
if ! nslookup "$DB_HOST" >/dev/null 2>&1; then
  echo -e "${RED}✗ DNS resolution failed for '$DB_HOST'${NC}"
  echo -e "${YELLOW}Troubleshooting steps:${NC}"
  echo -e "  1. Disable VPN and try again"
  echo -e "  2. Flush DNS cache (macOS: sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder)"
  echo -e "  3. Try using public DNS (1.1.1.1 or 8.8.8.8)"
  echo -e "  4. Check if you can access: https://$DB_HOST"
  exit 1
fi
echo -e "${GREEN}✓ DNS resolution successful${NC}"

# Network connectivity check
echo -e "${YELLOW}[2/3] Testing network connectivity...${NC}"
if ! nc -z -w5 "$DB_HOST" 5432 2>/dev/null && ! nc -z -w5 "$DB_HOST" 6543 2>/dev/null; then
  echo -e "${RED}✗ Cannot reach database host on ports 5432 or 6543${NC}"
  echo -e "${YELLOW}Troubleshooting steps:${NC}"
  echo -e "  1. Check firewall settings"
  echo -e "  2. Verify you're not behind a restrictive network"
  echo -e "  3. Check Supabase project status: https://supabase.com/dashboard/project/${NEW_PROJECT_ID}"
  echo -e "  4. Verify database is not paused"
  exit 1
fi
echo -e "${GREEN}✓ Network connectivity successful${NC}"

# Database authentication check
echo -e "${YELLOW}[3/3] Testing database authentication...${NC}"
if ! PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p 5432 -U postgres -d "$DB_NAME" -c "SELECT 1" -w --connect-timeout=10 >/dev/null 2>&1; then
  echo -e "${YELLOW}Direct connection (5432) failed; trying pooling (6543)...${NC}"
  if PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p 6543 -U postgres -d "$DB_NAME" -c "SELECT 1" -w --connect-timeout=10 >/dev/null 2>&1; then
    export NEW_DB_URL="postgresql://postgres:${DB_PASS}@${DB_HOST}:6543/${DB_NAME}?sslmode=require&connect_timeout=10"
    echo -e "${GREEN}✓ Using pooling port 6543 for migration${NC}"
  else
    echo -e "${RED}✗ Authentication failed on both ports${NC}"
    echo -e "${YELLOW}Troubleshooting steps:${NC}"
    echo -e "  1. Verify password in new-supabase-config.env is correct"
    echo -e "  2. Check database connection string in Supabase dashboard:"
    echo -e "     Project Settings → Database → Connection String"
    echo -e "  3. Ensure no extra spaces or special characters in password"
    echo -e "  4. Verify database is not paused or deleted"
    echo -e "  5. Check if IP is whitelisted (if IP restrictions enabled)"
    echo ""
    echo -e "${YELLOW}Current connection string format:${NC}"
    echo -e "  postgresql://postgres:[PASSWORD]@$DB_HOST:5432/$DB_NAME"
    exit 1
  fi
else
  export NEW_DB_URL="postgresql://postgres:${DB_PASS}@${DB_HOST}:5432/${DB_NAME}?sslmode=require&connect_timeout=10"
  echo -e "${GREEN}✓ Direct connection successful (5432)${NC}"
fi
echo ""

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
