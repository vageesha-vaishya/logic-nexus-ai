#!/bin/bash

# Script to setup logging secrets for Supabase Edge Functions
# Usage: ./scripts/setup_logging_secrets.sh

SUPABASE_CLI="./node_modules/.bin/supabase"

if [ ! -x "$SUPABASE_CLI" ]; then
  echo "❌ Supabase CLI binary not found at $SUPABASE_CLI"
  echo "   Run: npm install --no-save supabase"
  exit 1
fi

PROJECT_REF="${PROJECT_REF:-}"
if [ -z "$PROJECT_REF" ]; then
  read -p "Enter Supabase project ref: " PROJECT_REF
fi

if [ -z "$PROJECT_REF" ]; then
  echo "❌ Project ref is required."
  exit 1
fi

echo "----------------------------------------------------------------"
echo "🔐 Supabase Logging System Secrets Setup"
echo "----------------------------------------------------------------"
echo "This script will help you set up the required secrets for the"
echo "Alerting & Intelligence phase of the Logging System."
echo "Target project ref: $PROJECT_REF"
echo ""

# Function to prompt and set secret
set_secret() {
  local key=$1
  local description=$2
  local example=$3
  
  echo "👉 $key"
  echo "   $description"
  echo "   Example: $example"
  read -p "   Enter value (press Enter to skip): " value
  
  if [ -n "$value" ]; then
    echo "   Setting $key..."
    "$SUPABASE_CLI" secrets set --project-ref "$PROJECT_REF" "$key=$value"
    echo "   ✅ $key set."
  else
    echo "   ⚠️  Skipped $key."
  fi
  echo ""
}

# Check if user is logged in
echo "Checking Supabase login status..."
if ! "$SUPABASE_CLI" projects list > /dev/null 2>&1; then
  echo "❌ You are not logged in to Supabase CLI or cannot list projects."
  echo "   Please run './node_modules/.bin/supabase login' first."
  exit 1
fi

echo "✅ CLI is ready."
echo ""

set_secret "SLACK_WEBHOOK_URL" "Slack Webhook URL for Critical Alerts" "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX"
set_secret "RESEND_API_KEY" "Resend.com API Key for Email Alerts" "re_123456789"
set_secret "ALERT_EMAIL_TO" "Recipient Email Address for Alerts" "dev-ops@soslogistics.pro"

echo "----------------------------------------------------------------"
echo "🎉 Setup Complete!"
echo "   The 'alert-notifier' function will now use these secrets."
echo "----------------------------------------------------------------"
