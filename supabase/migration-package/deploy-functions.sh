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
echo -e "${BLUE}Deploying edge functions...${NC}"
echo ""

# List of functions to deploy
FUNCTIONS=(
    "create-user"
    "exchange-oauth-token"
    "get-account-label"
    "get-contact-label"
    "get-opportunity-full"
    "get-opportunity-label"
    "get-service-label"
    "list-edge-functions"
    "process-lead-assignments"
    "salesforce-sync-opportunity"
    "search-emails"
    "seed-platform-admin"
    "send-email"
    "sync-all-mailboxes"
    "sync-emails"
)

# Deploy each function
for func in "${FUNCTIONS[@]}"; do
    echo -e "${BLUE}Deploying $func...${NC}"
    cd ../..
    supabase functions deploy "$func" --project-ref "$NEW_PROJECT_ID"
    cd supabase/migration-package
    echo -e "${GREEN}✓ $func deployed${NC}"
done

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
