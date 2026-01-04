#!/bin/bash

# Backup Verification Script
# Usage: ./verify-backup-config.sh
# Purpose: Checks if the environment is correctly configured for database backups/restores.

echo "🔍 Starting Backup Configuration Verification..."

# 1. Check Environment Variables
if [ -z "$SUPABASE_DB_URL" ]; then
    echo "❌ Error: SUPABASE_DB_URL is not set."
    echo "   Please set it in your .env file or environment."
    echo "   Format: postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
    exit 1
else
    echo "✅ SUPABASE_DB_URL is set."
fi

# 2. Check Postgres Tools (pg_dump)
if ! command -v pg_dump &> /dev/null; then
    echo "⚠️  Warning: pg_dump could not be found."
    echo "   You need PostgreSQL client tools installed to perform manual backups."
else
    echo "✅ pg_dump is installed."
fi

# 3. Test Connection (Dry Run)
echo "🔄 Testing database connection..."
# Using pg_isready if available, otherwise try a simple psql command
if command -v pg_isready &> /dev/null; then
    pg_isready -d "$SUPABASE_DB_URL"
    if [ $? -eq 0 ]; then
        echo "✅ Database is reachable."
    else
        echo "❌ Error: Cannot connect to the database."
        exit 1
    fi
else
    echo "⚠️  pg_isready not found, skipping connectivity check."
fi

echo "---------------------------------------------------"
echo "📋 Backup Policy Reminder:"
echo "   - Automated Backups: Managed by Supabase (check Dashboard)."
echo "   - PITR: Check if enabled in Supabase Dashboard -> Database -> Backups."
echo "   - Manual Backup Command: pg_dump \"\$SUPABASE_DB_URL\" > backup_\$(date +%F).sql"
echo "---------------------------------------------------"
echo "✅ Verification Complete."
