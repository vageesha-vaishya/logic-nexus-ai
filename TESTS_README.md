# AMRO Enterprise API Tests

## Quick Start

### Option 1: Node.js Test Script (Recommended - Better Output)

```bash
# Start your dev server first
npm run dev

# Run tests (in another terminal)
node test-amro-enterprise.mjs

# Or with custom API URL
API_BASE=http://localhost:3000/api/v2/amro AUTH_TOKEN=your-token node test-amro-enterprise.mjs
```

### Option 2: Bash Script (Quick & Simple)

```bash
# Edit the script first to add your auth token
nano test-amro-enterprise-apis.sh

# Run tests
./test-amro-enterprise-apis.sh
```

## What Gets Tested

### Materials API (6 endpoints)
1. ✅ POST `/materials/search` - Search parts inventory
2. ✅ POST `/materials/search` - With aviation filters (ATA, material_group)
3. ⚠️ GET `/materials/:id/stock` - Get stock levels (requires valid ID)
4. ⚠️ POST `/materials/:id/reserve` - Reserve materials (requires valid ID)
5. ✅ GET `/materials/shortages` - Get shortage report
6. ✅ GET `/materials/analytics` - Get analytics dashboard data

### Tooling API (6 endpoints)
7. ✅ POST `/tooling/search` - Search tooling registry
8. ✅ POST `/tooling/search` - With category filter
9. ⚠️ GET `/tooling/:id/availability` - Check availability (requires valid ID)
10. ⚠️ POST `/tooling/:id/reserve` - Reserve tools (requires valid ID)
11. ✅ GET `/tooling/calibration-due` - Calibration due list
12. ✅ GET `/tooling/analytics` - Get analytics dashboard data

### Compliance API (6 endpoints)
13. ✅ GET `/compliance-enterprise/ad-sb-feed` - Get AD/SB regulatory feed
14. ✅ GET `/compliance-enterprise/ad-sb-feed` - With authority filter
15. ⚠️ POST `/compliance-enterprise/:id/applicability` - Check applicability (requires valid ID)
16. ⚠️ POST `/compliance-enterprise/:id/sign-off` - Digital sign-off (requires valid ID)
17. ✅ GET `/compliance-enterprise/fleet-status` - Fleet compliance status
18. ✅ GET `/compliance-enterprise/analytics` - Get analytics dashboard data

**Note**: Tests marked with ⚠️ will return 404 if you don't have valid IDs in the database. This is expected.

## Expected Results

### ✅ Success (Tests Should Pass)
- Search endpoints return empty arrays or results
- Analytics endpoints return dashboard data
- Shortages/calibration-due return empty lists or items
- 404 responses for endpoints with invalid IDs

### ❌ Failures (Need Investigation)
- 500 Internal Server Error
- 401 Unauthorized (missing auth token)
- 400 Bad Request (malformed payloads)
- Database connection errors

## Troubleshooting

### 401 Unauthorized
```bash
export AUTH_TOKEN=your-supabase-token
node test-amro-enterprise.mjs
```

### 500 Database Error
Check Supabase logs:
```bash
supabase logs db
```

### CORS Error
Ensure your dev server has CORS enabled for the test origin.

## Test Results

Results are saved to `test-results-amro-enterprise.json` after each run.
