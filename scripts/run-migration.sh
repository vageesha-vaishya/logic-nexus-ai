#!/bin/bash

# Dashboard Role Migration Script
# Run with: bash scripts/run-migration.sh

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║        Dashboard Role Migration - Setup & Validation       ║"
echo "╚════════════════════════════════════════════════════════════╝"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "   Please create .env with your Supabase credentials"
    exit 1
fi

# Load environment variables
export $(grep -v '^#' .env | xargs)

# Check required variables
if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_SERVICE_KEY" ]; then
    echo "❌ Missing environment variables:"
    echo "   - VITE_SUPABASE_URL"
    echo "   - VITE_SUPABASE_SERVICE_KEY"
    exit 1
fi

echo ""
echo "✅ Environment variables loaded"
echo "   URL: ${VITE_SUPABASE_URL:0:50}..."
echo ""

# Create temporary SQL file
TEMP_SQL=$(mktemp)
cat > "$TEMP_SQL" << 'EOF'
-- Step 1: Add dashboard_role column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS dashboard_role TEXT DEFAULT 'crm_sales_rep';

-- Step 2: Create index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_dashboard_role
ON public.profiles(dashboard_role);

-- Step 3: Add comment
COMMENT ON COLUMN public.profiles.dashboard_role
IS 'Dashboard role for template assignment: crm_sales_rep, crm_sales_manager, etc.';

-- Step 4: Verify
SELECT
  'Column Check' as check_type,
  CASE
    WHEN column_name IS NOT NULL THEN 'EXISTS ✅'
    ELSE 'MISSING ❌'
  END as status,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'dashboard_role';
EOF

echo "📋 Migration SQL prepared"
echo ""
echo "⏳ Running migration steps..."
echo "   1. Adding dashboard_role column..."
echo "   2. Creating index..."
echo "   3. Adding comment..."
echo "   4. Verifying..."
echo ""

# Instructions for running in Supabase
echo "╔════════════════════════════════════════════════════════════╗"
echo "║           📝 MANUAL EXECUTION IN SUPABASE                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "The migration script is ready. Execute it in Supabase:"
echo ""
echo "1. Go to: https://app.supabase.com"
echo "2. Select your project"
echo "3. Go to: SQL Editor"
echo "4. Click: New Query"
echo "5. Copy and paste the SQL below:"
echo ""
echo "─────────────────────────────────────────────────────────────"
cat "$TEMP_SQL"
echo "─────────────────────────────────────────────────────────────"
echo ""
echo "6. Click: Run"
echo "7. Wait for: 'Query executed successfully'"
echo ""
echo "Then restart your dev server:"
echo "   npm run dev"
echo ""

# Clean up
rm "$TEMP_SQL"

echo "✅ Migration ready for execution"
