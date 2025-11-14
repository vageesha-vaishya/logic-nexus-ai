#!/bin/bash

# Authenticated Data Export from Lovable Cloud
# Uses platform admin credentials to export all data

set -e

echo "============================================"
echo "  Authenticated Data Export"
echo "============================================"
echo ""

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

# Navigate to helpers directory
cd "$(dirname "$0")/helpers"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install @supabase/supabase-js papaparse
fi

# Run the export
echo ""
echo "🚀 Starting authenticated export..."
echo ""

node export-authenticated.js

echo ""
echo "============================================"
echo "  Export Complete!"
echo "============================================"
