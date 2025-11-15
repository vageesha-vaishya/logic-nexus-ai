#!/bin/bash

# Deploy Edge Functions to New Supabase Project

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo "=========================================="
echo "  Edge Functions Deployment"
echo "=========================================="
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${YELLOW}Supabase CLI not found. Installing...${NC}"
    npm install -g supabase
fi

# Load config
source new-supabase-config.env

# Check if already linked
if [ -f "../../.git/config" ]; then
    echo -e "${BLUE}Linking to new Supabase project...${NC}"
    cd ../..
    supabase link --project-ref "$NEW_PROJECT_ID"
    cd supabase/migration-package
fi

echo ""
echo -e "${BLUE}Discovering and deploying edge functions...${NC}"
echo ""

# Discover all function directories under supabase/functions (excluding _shared)
cd ../..
FUNCTIONS_DIR="supabase/functions"
FUNCTIONS=()
for d in "$FUNCTIONS_DIR"/*/; do
    [ -d "$d" ] || continue
    name="$(basename "$d")"
    [ "$name" = "_shared" ] && continue
    FUNCTIONS+=("$name")
done

if [ ${#FUNCTIONS[@]} -eq 0 ]; then
    echo -e "${YELLOW}No edge functions found to deploy in $FUNCTIONS_DIR${NC}"
    cd supabase/migration-package
else
    echo -e "${BLUE}Functions to deploy:${NC} ${FUNCTIONS[*]}"
    for func in "${FUNCTIONS[@]}"; do
        echo -e "${BLUE}Deploying $func...${NC}"
        supabase functions deploy "$func" --project-ref "$NEW_PROJECT_ID"
        echo -e "${GREEN}✓ $func deployed${NC}"
    done
    cd supabase/migration-package
fi

echo ""
echo -e "${GREEN}=========================================="
echo "✓ All edge functions deployed"
echo "==========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Set function secrets: supabase secrets set KEY=value"
echo "2. Test functions in Supabase dashboard"
echo "3. Update app to use new function URLs"
echo ""
