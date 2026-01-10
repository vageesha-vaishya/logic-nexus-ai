#!/bin/bash
set -e

# Load Configuration
if [ -f "migration.env" ]; then
    source migration.env
else
    echo "Error: migration.env not found. Please copy migration.env.template and configure it."
    exit 1
fi

# Default to migrations directory if no argument provided
SCRIPT_PATH=${1:-"../../migrations"}

# Resolve absolute path
if [[ "$SCRIPT_PATH" != /* ]]; then
    SCRIPT_PATH="$(pwd)/$SCRIPT_PATH"
fi

echo "🚀 Starting SQL Execution..."
echo "Target: $TARGET_DB_URL"
echo "Source Path: $SCRIPT_PATH"

# Create logs directory
mkdir -p logs
LOG_FILE="logs/sql-execution-$(date +%Y%m%d_%H%M%S).log"

# Run Node Script
if command -v node >/dev/null 2>&1; then
    node scripts/apply-sql.js "$TARGET_DB_URL" "$SCRIPT_PATH" | tee -a "$LOG_FILE"
else
    echo "Error: Node.js not found."
    exit 1
fi

echo "✅ Execution finished. Check logs for details."
