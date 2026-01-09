# Quotation Testing Implementation - Complete Guide

## Overview
Comprehensive testing infrastructure created for QUO-000002 multi-modal quotation workflows, covering all CRUD operations, edge cases, and validation scenarios.

## What Was Created

### 1. Test Plan Document
**File**: `QUOTATION_TEST_PLAN.md`

Detailed test scenarios organized into 7 phases:
- **Phase 1**: Initial option creation (INSERT operations)
- **Phase 2**: Update operations on existing data
- **Phase 3**: Mixed INSERT + UPDATE operations
- **Phase 4**: DELETE operations and cascade cleanup
- **Phase 5**: Edge cases and complex scenarios
- **Phase 6**: Validation and error handling
- **Phase 7**: Cost calculation verification

Each phase contains multiple test cases with:
- Clear objectives
- Step-by-step instructions
- Expected results
- Success criteria

### 2. Interactive Test Runner Component
**File**: `src/components/testing/QuotationTestRunner.tsx`

Features:
- ✅ **18 comprehensive test cases** covering all scenarios
- ✅ **Phase-based organization** for logical testing flow
- ✅ **Interactive checklist** for each test step
- ✅ **Status tracking** (pending, running, passed, failed, skipped)
- ✅ **Quick access** to quote editor with "Open in Editor" button
- ✅ **Progress dashboard** showing passed/failed/pending counts
- ✅ **Detailed instructions** for each test
- ✅ **Expected results** for verification

### 3. Test Route
**Route**: `/testing/quotations`
**File**: `src/pages/testing/QuotationTests.tsx`

Access the test runner at: `http://localhost:5173/testing/quotations`

## How to Use the Testing Suite

### Step 1: Access Test Runner
Navigate to `/testing/quotations` in your browser

### Step 2: Review Test Plan
Open `QUOTATION_TEST_PLAN.md` to understand the full testing strategy

### Step 3: Execute Tests Sequentially

#### For Each Test Case
1. **Click "Start Test"** to mark it as active
2. **Click "Open in Editor"** to open QUO-000002 in quote composer
3. **Follow each step** in the checklist
4. **Check off steps** as you complete them
5. **Verify expected results** after saving
6. **Mark test status** (passed/failed) based on outcome

### Step 4: Database Verification
After critical tests (especially deletion tests), run queries to verify:

```sql
-- Check for orphaned legs
SELECT ql.id, ql.quote_option_id
FROM quote_legs ql
LEFT JOIN quotation_version_options qvo ON qvo.id = ql.quote_option_id
WHERE qvo.id IS NULL;

-- Check for orphaned charges
SELECT qc.id, qc.quote_option_id, qc.leg_id
FROM quote_charges qc
LEFT JOIN quotation_version_options qvo ON qvo.id = qc.quote_option_id
WHERE qvo.id IS NULL;

-- Check for orphaned option-leg links
SELECT qvol.id, qvol.quotation_version_option_id
FROM quotation_version_option_legs qvol
LEFT JOIN quotation_version_options qvo ON qvo.id = qvol.quotation_version_option_id
WHERE qvo.id IS NULL;

-- Verify QUO-000002 current state
SELECT 
  qvo.name as option_name,
  qvo.total_buy_cost,
  qvo.total_sell_cost,
  qvo.profit_amount,
  qvo.margin_percentage,
  COUNT(DISTINCT qvol.id) as leg_count,
  COUNT(DISTINCT qc.id) as charge_count
FROM quotation_version_options qvo
LEFT JOIN quotation_version_option_legs qvol ON qvol.quotation_version_option_id = qvo.id
LEFT JOIN quote_charges qc ON qc.quote_option_id = qvo.id
WHERE qvo.quotation_version_id IN (
  SELECT id FROM quotation_versions WHERE quote_id = '471cc5f2-29e5-4015-8bf2-c60ab69df476'
)
GROUP BY qvo.id, qvo.name, qvo.total_buy_cost, qvo.total_sell_cost, qvo.profit_amount, qvo.margin_percentage;
```

## Test Scenarios by Priority

### Critical Tests (Must Pass)
1. **Test 1.1** - Create first option with complete data
2. **Test 2.2** - Update charge rates
3. **Test 3.3** - Mixed update and insert
4. **Test 4.1** - Delete entire leg (cascade test)
5. **Test 4.3** - Multiple deletions in one save
6. **Test 7.2** - Option-level cost verification

### Important Tests
1. **Test 1.2** - Multiple options
2. **Test 2.1** - Update leg details
3. **Test 3.1** - Add leg to existing option
4. **Test 4.2** - Delete individual charges
5. **Test 7.1** - Leg-level cost verification

### Edge Case Tests
1. **Test 5.1** - Empty option
2. **Test 5.2** - Leg with no charges
3. **Test 5.3** - Massive concurrent update

## Expected Test Data

### After Test 1.1 (Option A Creation)
```text
Option A:
  Leg 1 (Ocean): Buy $1,080 | Sell $1,300
    - Freight: $1,000/$1,200
    - BAF: $50/$60
    - CAF: $30/$40
  
  Leg 2 (Rail): Buy $350 | Sell $425
    - Rail freight: $300/$350
    - Terminal: $50/$75
  
  Leg 3 (Truck): Buy $175 | Sell $235
    - Delivery: $150/$200
    - Fuel: $25/$35
  
  Combined Charges: Buy $350 | Sell $430
    - Insurance: $100/$120
    - Documentation: $50/$60
    - Customs: $200/$250

  TOTAL: Buy $1,955 | Sell $2,390 | Profit $435 | Margin 18.2%
```

### After Test 1.2 (Option B Creation)
```text
Option B:
  Leg 1 (Air): Buy $2,100 | Sell $2,550
    - Air freight: $2,000/$2,400
    - Handling: $100/$150
  
  Leg 2 (Truck): Buy $80 | Sell $120
    - Delivery: $80/$120
  
  Combined Charges: Buy $150 | Sell $180
    - Insurance: $150/$180

  TOTAL: Buy $2,330 | Sell $2,850 | Profit $520 | Margin 18.2%
```

## Success Criteria

### Data Integrity ✓
- No orphaned records in any table
- All foreign keys valid and consistent
- Referential integrity maintained throughout

### Calculation Accuracy ✓
- Leg totals = sum of leg's charges
- Option buy total = sum(all legs buy) + sum(combined buy)
- Option sell total = sum(all legs sell) + sum(combined sell)
- Profit = sell - buy
- Margin = (profit / sell) × 100

### UI Consistency ✓
- UI reflects database state immediately after save
- Loading states shown during operations
- Success/error messages displayed appropriately
- Validation warnings shown for edge cases

### Error Handling ✓
- Invalid data rejected with clear messages
- Failed operations don't leave partial data
- Deletion confirmations prevent accidental data loss
- Network errors handled gracefully

### Performance ✓
- Save operations complete within 5 seconds
- UI remains responsive during save
- No memory leaks from repeated operations

## Troubleshooting

### Issue: Test fails with "Cannot find quotation"
**Solution**: Verify QUO-000002 exists in database. Check quote ID is correct.

### Issue: Orphaned records after deletion test
**Solution**: This indicates a bug in cascade deletion. Check:
1. `chargesToDelete` state being populated correctly
2. Deletion queries executing before inserting new data
3. Foreign key constraints configured properly

### Issue: Cost calculations don't match
**Solution**: Review calculation logic in `ReviewAndSaveStep.tsx`. Verify:
1. All charges included in totals
2. Buy and sell rates read from correct fields
3. Quantity and rate multiplication correct
4. Combined charges added to option totals

### Issue: Save operation times out
**Solution**: Check:
1. Too many operations in single save
2. Database performance issues
3. Network latency
4. Missing indexes on foreign keys

## Next Steps

After completing all tests:

1. **Document Results**: Record pass/fail status for each test
2. **Fix Bugs**: Address any failed tests before production
3. **Performance Optimization**: If save times exceed 5s, optimize queries
4. **Add Automated Tests**: Convert manual tests to Playwright/Jest tests
5. **Update Documentation**: Reflect any discovered edge cases

## Files Modified/Created

### Created
- `QUOTATION_TEST_PLAN.md` - Comprehensive test plan
- `src/components/testing/QuotationTestRunner.tsx` - Interactive test runner
- `src/pages/testing/QuotationTests.tsx` - Test page component
- `TESTING_IMPLEMENTATION.md` - This guide

### Modified
- `src/App.tsx` - Added test route

## Access Information

- **Test Runner URL**: `/testing/quotations`
- **Quote to Test**: QUO-000002
- **Quote ID**: 471cc5f2-29e5-4015-8bf2-c60ab69df476
- **Version ID**: d1b61118-abe4-4d90-96e9-b2b3226656ca
- **Tenant ID**: 37a4d9ca-626d-4ed3-9e71-5d416e7ccaf8

## Timeline

Estimated time to complete full test suite: **2-3 hours**

- Phase 1: 30 minutes
- Phase 2: 20 minutes
- Phase 3: 25 minutes
- Phase 4: 30 minutes
- Phase 5: 20 minutes
- Phase 7: 15 minutes
- Documentation/Verification: 20 minutes

---

**Ready to start testing!** Access `/testing/quotations` and begin with Test 1.1.
