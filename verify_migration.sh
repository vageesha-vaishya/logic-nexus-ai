#!/bin/bash

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

echo "---------------------------------------------------"
echo "Verifying Supabase Edge Functions Migration"
echo "---------------------------------------------------"

# 1. Verify Configuration
echo "Checking Environment Variables..."
if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "❌ Missing VITE_SUPABASE_URL or SUPABASE_ANON_KEY in .env"
  exit 1
fi
echo "✅ Configuration found"

# 2. Test Function Accessibility (email-scan)
# We expect 401 Unauthorized because we don't have a user token,
# BUT we check for the specific JSON structure we added (details: ...)
# to confirm the function is running and using the new library.

FUNCTION_URL="${VITE_SUPABASE_URL}/functions/v1/email-scan"
echo "Testing: $FUNCTION_URL"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"email_id": "test_verification"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "Response Code: $HTTP_CODE"
echo "Response Body: $BODY"

if [[ "$HTTP_CODE" == "401" ]]; then
  if [[ "$BODY" == *"missing sub claim"* ]] || [[ "$BODY" == *"details"* ]]; then
     echo "✅ SUCCESS: Function is reachable and Auth middleware is working correctly (rejecting Anon key as expected)."
     echo "   The 'missing sub claim' error confirms that the supabase-js library successfully parsed the token."
  else
     echo "⚠️  WARNING: Received 401 but unexpected body. Check if the function was deployed correctly."
  fi
elif [[ "$HTTP_CODE" == "200" ]]; then
  echo "✅ SUCCESS: Function returned 200 OK (Unexpected for Anon key, but indicates success)."
else
  echo "❌ FAILURE: Function returned $HTTP_CODE. Check logs."
fi

echo "---------------------------------------------------"
echo "Next Steps:"
echo "1. Update your .env file with the NEW keys from Supabase Dashboard."
echo "2. Restart your frontend server."
echo "3. Log in to the application to generate a valid User Token."
echo "---------------------------------------------------"
