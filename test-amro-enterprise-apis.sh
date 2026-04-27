#!/bin/bash
# AMRO Enterprise API Test Script
# Tests all 18 endpoints across Materials, Tooling, and Compliance APIs

# Configuration - Update these values
API_BASE="http://localhost:3000/api/v2/amro"
AUTH_TOKEN="" # Add your auth token here

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "AMRO Enterprise API Test Suite"
echo "=========================================="
echo ""

# Helper function
test_endpoint() {
  local name=$1
  local method=$2
  local url=$3
  local data=$4
  
  echo -e "${YELLOW}Testing: ${name}${NC}"
  echo "URL: ${method} ${url}"
  
  if [ -n "$data" ]; then
    response=$(curl -s -w "\n%{http_code}" -X "${method}" \
      -H "Authorization: Bearer ${AUTH_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "${data}" \
      "${url}")
  else
    response=$(curl -s -w "\n%{http_code}" -X "${method}" \
      -H "Authorization: Bearer ${AUTH_TOKEN}" \
      -H "Content-Type: application/json" \
      "${url}")
  fi
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    echo -e "${GREEN}✓ SUCCESS (${http_code})${NC}"
    echo "$body" | head -c 500
    echo ""
  else
    echo -e "${RED}✗ FAILED (${http_code})${NC}"
    echo "$body"
  fi
  
  echo ""
  echo "------------------------------------------"
  echo ""
  sleep 1
}

# ==========================================
# MATERIALS API TESTS (6 endpoints)
# ==========================================

echo "📦 MATERIALS API TESTS"
echo "=========================================="
echo ""

# Test 1: Search Materials
test_endpoint \
  "Search Materials" \
  "POST" \
  "${API_BASE}/materials/search" \
  '{"query": "", "limit": 10, "offset": 0}'

# Test 2: Search with Aviation Filters
test_endpoint \
  "Search Materials (with ATA filter)" \
  "POST" \
  "${API_BASE}/materials/search" \
  '{"query": "", "ata_chapter": "79-21-00", "material_group": "rotable", "limit": 10}'

# Test 3: Get Material Stock (will fail without valid ID, expected)
test_endpoint \
  "Get Material Stock" \
  "GET" \
  "${API_BASE}/materials/00000000-0000-0000-0000-000000000000/stock" \
  ""

# Test 4: Reserve Material (will fail without valid ID, expected)
test_endpoint \
  "Reserve Material" \
  "POST" \
  "${API_BASE}/materials/00000000-0000-0000-0000-000000000000/reserve" \
  '{"quantity": 5, "work_order_id": "test-wp-id"}'

# Test 5: Get Shortages
test_endpoint \
  "Get Material Shortages" \
  "GET" \
  "${API_BASE}/materials/shortages" \
  ""

# Test 6: Get Analytics
test_endpoint \
  "Get Materials Analytics" \
  "GET" \
  "${API_BASE}/materials/analytics" \
  ""

# ==========================================
# TOOLING API TESTS (6 endpoints)
# ==========================================

echo ""
echo "🔧 TOOLING API TESTS"
echo "=========================================="
echo ""

# Test 7: Search Tools
test_endpoint \
  "Search Tools" \
  "POST" \
  "${API_BASE}/tooling/search" \
  '{"query": "", "limit": 10, "offset": 0}'

# Test 8: Search with Category Filter
test_endpoint \
  "Search Tools (with category)" \
  "POST" \
  "${API_BASE}/tooling/search" \
  '{"query": "", "tool_category": "hand_tool", "limit": 10}'

# Test 9: Get Tool Availability (will fail without valid ID, expected)
test_endpoint \
  "Get Tool Availability" \
  "GET" \
  "${API_BASE}/tooling/00000000-0000-0000-0000-000000000000/availability" \
  ""

# Test 10: Reserve Tool (will fail without valid ID, expected)
test_endpoint \
  "Reserve Tool" \
  "POST" \
  "${API_BASE}/tooling/00000000-0000-0000-0000-000000000000/reserve" \
  '{"quantity": 1, "reservation_date": "2026-04-20", "return_date": "2026-04-25"}'

# Test 11: Get Calibration Due
test_endpoint \
  "Get Calibration Due List" \
  "GET" \
  "${API_BASE}/tooling/calibration-due" \
  ""

# Test 12: Get Tooling Analytics
test_endpoint \
  "Get Tooling Analytics" \
  "GET" \
  "${API_BASE}/tooling/analytics" \
  ""

# ==========================================
# COMPLIANCE API TESTS (6 endpoints)
# ==========================================

echo ""
echo "📋 COMPLIANCE API TESTS"
echo "=========================================="
echo ""

# Test 13: Get AD/SB Feed
test_endpoint \
  "Get AD/SB Feed" \
  "GET" \
  "${API_BASE}/compliance-enterprise/ad-sb-feed" \
  ""

# Test 14: Get AD/SB Feed with Filter
test_endpoint \
  "Get AD/SB Feed (FAA only)" \
  "GET" \
  "${API_BASE}/compliance-enterprise/ad-sb-feed?regulatory_authority=FAA" \
  ""

# Test 15: Check Applicability (will fail without valid ID, expected)
test_endpoint \
  "Check Compliance Applicability" \
  "POST" \
  "${API_BASE}/compliance-enterprise/00000000-0000-0000-0000-000000000000/applicability" \
  '{"aircraft_model": "A320neo"}'

# Test 16: Sign Off Compliance (will fail without valid ID, expected)
test_endpoint \
  "Sign Off Compliance" \
  "POST" \
  "${API_BASE}/compliance-enterprise/00000000-0000-0000-0000-000000000000/sign-off" \
  '{"compliance_date": "2026-04-13", "complied_method": "Test", "digital_signature": {"certifying_staff_id": "test", "license_number": "test", "license_type": "B1", "license_expiry": "2027-12-31", "organization": "Test"}}'

# Test 17: Get Fleet Status
test_endpoint \
  "Get Fleet Compliance Status" \
  "GET" \
  "${API_BASE}/compliance-enterprise/fleet-status" \
  ""

# Test 18: Get Compliance Analytics
test_endpoint \
  "Get Compliance Analytics" \
  "GET" \
  "${API_BASE}/compliance-enterprise/analytics" \
  ""

echo ""
echo "=========================================="
echo "✅ TEST SUITE COMPLETE"
echo "=========================================="
echo ""
echo "Review the output above for any errors."
echo "Expected failures (404) for endpoints requiring valid IDs are normal."
echo "Unexpected failures (500, 400, 401) need investigation."
