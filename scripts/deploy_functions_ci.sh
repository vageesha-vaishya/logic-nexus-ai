#!/bin/bash
# Usage: ./deploy_functions_ci.sh <project_ref> <access_token>

PROJECT_REF=$1
ACCESS_TOKEN=$2

if [ -z "$PROJECT_REF" ] || [ -z "$ACCESS_TOKEN" ]; then
  echo "Error: Missing arguments."
  echo "Usage: ./deploy_functions_ci.sh <project_ref> <access_token>"
  exit 1
fi

echo "Linking to Supabase project: $PROJECT_REF"
# Link project non-interactively
npx supabase link --project-ref "$PROJECT_REF" --password "$ACCESS_TOKEN"

echo "Deploying Edge Functions..."
# Deploy all functions without verifying JWT (assuming functions handle auth internally)
npx supabase functions deploy --project-ref "$PROJECT_REF" --password "$ACCESS_TOKEN" --no-verify-jwt

echo "Deployment Complete."
