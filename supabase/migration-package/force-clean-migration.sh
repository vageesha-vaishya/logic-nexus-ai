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

# Step 1: Cleanup
echo ""
echo -e "${GREEN}[1/4] Cleaning existing database...${NC}"
bash 02-cleanup-existing.sh

# Step 2: Apply schema
echo ""
echo -e "${GREEN}[2/4] Applying fresh schema...${NC}"
source new-supabase-config.env
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
