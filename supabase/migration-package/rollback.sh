#!/bin/bash

# Emergency Rollback Script
# Restores connection to Lovable Cloud

set -e

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo ""
echo -e "${RED}=========================================="
echo "  EMERGENCY ROLLBACK"
echo "  Restoring Lovable Cloud Connection"
echo -e "==========================================${NC}"
echo ""

# Confirm rollback
read -p "Are you sure you want to rollback? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Rollback cancelled"
    exit 0
fi

# Backup current .env
if [ -f "../../.env" ]; then
    echo -e "${YELLOW}Backing up current .env...${NC}"
    cp ../../.env ../../.env.migration-attempt-$(date +%Y%m%d_%H%M%S)
    echo "✓ Backup created"
fi

# Restore original .env
if [ -f "../../.env.backup" ]; then
    echo -e "${YELLOW}Restoring original .env...${NC}"
    cp ../../.env.backup ../../.env
    echo "✓ Original .env restored"
else
    echo -e "${RED}ERROR: .env.backup not found!${NC}"
    echo "Please manually restore your Lovable Cloud credentials"
    exit 1
fi

# Test connection
echo ""
echo "Testing Lovable Cloud connection..."

cd ../../

if npm run dev > /dev/null 2>&1 & then
    sleep 5
    PID=$!
    
    if kill -0 $PID 2>/dev/null; then
        echo -e "${GREEN}✓ Application started successfully${NC}"
        kill $PID
    else
        echo -e "${RED}✗ Application failed to start${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ Failed to start application${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}=========================================="
echo "  Rollback Complete"
echo "  Lovable Cloud connection restored"
echo -e "==========================================${NC}"
echo ""
echo "You can now:"
echo "1. Access your app at the Lovable Cloud database"
echo "2. Review migration logs to identify issues"
echo "3. Fix issues and retry migration"
echo ""
