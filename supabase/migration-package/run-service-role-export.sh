#!/bin/bash

# Service Role Export from Source Supabase
# Uses service role key to export all data (bypasses RLS and authentication)

set -e

echo "============================================"
echo "  Service Role Data Export"
echo "============================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Prompt for service role key if not set
if [ -z "$SOURCE_SERVICE_ROLE_KEY" ]; then
    echo "📝 Enter the SOURCE Supabase service role key:"
    echo "   (Find it in source project: Settings → API → service_role)"
    read -s SOURCE_SERVICE_ROLE_KEY
    export SOURCE_SERVICE_ROLE_KEY
    echo ""
fi

# Navigate to helpers directory
cd "$(dirname "$0")/helpers"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install @supabase/supabase-js papaparse
fi

# Run the export
echo ""
echo "🚀 Starting service role export..."
echo ""

node export-with-service-role.js

echo ""
echo "============================================"
echo "  Export Complete!"
echo "============================================"
