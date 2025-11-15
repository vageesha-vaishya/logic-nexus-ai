#!/bin/bash

# Authenticated Data Export from Lovable Cloud
# Uses platform admin credentials to export all data

set -e

echo "============================================"
echo "  Authenticated Data Export"
echo "============================================"
echo ""

# Load environment from new-supabase-config.env
set -a
. ./new-supabase-config.env
set +a

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm/npx is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

cd "$(dirname "$0")/helpers"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install @supabase/supabase-js papaparse
fi

echo ""
if [ -n "$SOURCE_SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "🔑 Service-role key detected. Running full REST export (bypasses RLS)..."
  node export-rest.js
else
  echo "⚠️ No service-role key provided. Running authenticated admin export (may be limited by RLS)."
  node export-authenticated.js
fi

echo ""
echo "============================================"
echo "  Export Complete!"
echo "============================================"
