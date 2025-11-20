# Multi-Modal Quotation Testing Plan - Production Readiness

## Overview
Comprehensive test plan for the multi-modal quotation module covering transport mode selection, service type mapping, leg configuration, charges management, cost calculations, and save operations.

**Target Quote**: QUO-000002  
**Quote ID**: 471cc5f2-29e5-4015-8bf2-c60ab69df476  
**Version ID**: cae4cb72-7f05-47be-899e-8e3bb9a6fd83  
**Test Environment**: Production-ready validation  
**Last Updated**: 2025-11-20

---

## Test Coverage Summary

| Phase | Tests | Priority | Focus Area |
|-------|-------|----------|------------|
| Phase 1 | 3 | Critical | Transport mode selection & service type mapping |
| Phase 2 | 4 | Critical | Leg configuration (transport & service-only) |
| Phase 3 | 5 | Critical | Charges management & calculations |
| Phase 4 | 2 | High | Option creation & comparison |
| Phase 5 | 3 | Critical | Save operations & cascade deletes |
| Phase 6 | 3 | High | Validation & error handling |
| Phase 7 | 3 | Critical | Cost calculations & margin |
| Phase 8 | 4 | Medium | Edge cases & large data |
| Phase 9 | 3 | Medium | UI/UX verification |
| Phase 10 | 2 | Critical | Database integrity |
| **Total** | **32** | | **Complete workflow coverage** |

---

## Phase 1: Transport Mode Selection & Service Type Mapping

### Test 1.1: Transport Mode Display & Selection
**Priority**: Critical  
**Objective**: Verify all transport modes display correctly with proper icons, colors, and selection behavior

**Steps**:
1. Navigate to multi-modal quote composer
2. Go to 'Transport Legs' step
3. Verify display of all transport modes:
   - Ocean (blue, ship icon)
   - Air (sky blue, plane icon)
   - Road (green, truck icon)
   - Rail (orange, train icon)
   - Courier (purple, package icon)
4. Click on Ocean transport mode
5. Verify visual selection (ring border, shadow effect)
6. Click on different mode (e.g., Air)
7. Verify selection updates correctly

**Expected Results**:
- All 5 transport modes visible with correct styling
- Icons match transport type
- Colors are distinct and accessible
- Selection state shows ring-2 ring-primary
- Only one mode selected at a time

**Success Criteria**:
- ✅ All modes render without errors
- ✅ Selection state is visually clear
- ✅ No console errors on mode selection

---

### Test 1.2: Service Type Auto-Selection
**Priority**: Critical  
**Objective**: Verify correct service type is automatically selected when adding a leg based on transport mode

**Steps**:
1. Select Ocean transport mode
2. Click 'Add Leg' button
3. Verify toast notification: "Service Type Auto-Selected"
4. Check service type dropdown shows ocean-related service (e.g., "Ocean Freight", "FCL", "LCL")
5. Verify leg label displays: "Leg 1 - Ocean Freight" (NOT UUID like "72E605C3-...")
6. Select Air transport mode
7. Click 'Add Leg'
8. Verify air-related service auto-selected (e.g., "Air Freight")
9. Verify leg label displays: "Leg 2 - Air Freight"
10. Repeat for Road, Rail, Courier modes

**Expected Results**:
- Service type automatically selected based on transport mode
- Toast notification confirms auto-selection
- Leg labels show service type NAME, not UUID
- Each transport mode maps to correct service types

**Database Verification**:
```sql
-- Verify service_types have correct transport_mode_id
SELECT st.id, st.name, tm.code, tm.name as mode_name
FROM service_types st
JOIN transport_modes tm ON st.transport_mode_id = tm.id
WHERE st.is_active = true;

-- Expected: Each service type linked to appropriate transport mode
```

**Success Criteria**:
- ✅ Auto-selection works for all transport modes
- ✅ No UUIDs displayed in leg labels
- ✅ Service type names are human-readable
- ✅ Toast notifications appear correctly

---

### Test 1.3: Service Type Dropdown Filtering
**Priority**: High  
**Objective**: Verify service type dropdown only shows relevant options for selected transport mode

**Steps**:
1. Add Ocean transport leg
2. Click on service type dropdown for that leg
3. Verify only ocean-related services appear (FCL, LCL, Ocean Freight)
4. Verify air services (Air Freight) do NOT appear
5. Select 'FCL' service type
6. Change transport mode to Air
7. Open service type dropdown again
8. Verify only air-related services appear
9. Verify ocean services are now filtered out

**Expected Results**:
- Service type dropdown filtered by transport mode
- Only relevant services shown
- Dropdown updates when transport mode changes
- Filter prevents selecting incompatible service types

**Success Criteria**:
- ✅ Filtering works correctly for all modes
- ✅ No irrelevant service types shown
- ✅ Dropdown updates dynamically

---

## Phase 2: Leg Configuration

### Test 2.1: Transport Leg - Origin & Destination
**Priority**: Critical  
**Objective**: Configure transport leg with origin and destination fields

**Steps**:
1. Add Ocean transport leg
2. Verify 'Transport' tab is selected by default
3. Verify Origin and Destination input fields are visible
4. Enter origin: "Shanghai Port (CNSHA)"
5. Enter destination: "Los Angeles Port (USLAX)"
6. Navigate to Charges step (step 3)
7. Navigate back to Legs step (step 2)
8. Verify origin and destination values are preserved
9. Edit destination to "Long Beach Port (USLGB)"
10. Navigate away and back again
11. Verify updated destination persists

**Expected Results**:
- Origin and destination fields appear for transport legs
- Values persist across navigation
- Edits are saved in component state
- No data loss when switching steps

**Success Criteria**:
- ✅ Input fields functional
- ✅ Data persists across navigation
- ✅ Updates save correctly

---

### Test 2.2: Service-Only Leg - Category Selection
**Priority**: Critical  
**Objective**: Configure service-only leg with service category instead of origin/destination

**Steps**:
1. Add Road transport leg
2. Click 'Service Only' tab
3. Verify service category dropdown appears
4. Verify origin/destination fields are hidden
5. Open service category dropdown
6. Verify categories available (Customs Clearance, Warehousing, etc.)
7. Select 'Customs Clearance'
8. Verify selection is saved
9. Add another service-only leg
10. Select 'Warehousing' category
11. Verify both service legs display correctly with category names

**Expected Results**:
- Service-only tab switches UI to show category dropdown
- Origin/destination fields hidden for service legs
- Service categories load from database
- Multiple service legs can coexist

**Database Verification**:
```sql
-- Verify service leg categories exist
SELECT * FROM service_leg_categories WHERE is_active = true;

-- Expected: At least 5-10 service categories available
```

**Success Criteria**:
- ✅ Tab switching works smoothly
- ✅ Correct fields shown/hidden
- ✅ Service categories selectable

---

### Test 2.3: Leg Type Switching
**Priority**: High  
**Objective**: Switch between transport and service-only leg types

**Steps**:
1. Add transport leg with origin 'New York' and destination 'Chicago'
2. Click 'Service Only' tab
3. Verify origin/destination fields disappear
4. Select service category 'Customs Clearance'
5. Click 'Transport' tab again
6. Verify origin/destination fields reappear
7. Verify fields may be empty or retain previous values
8. Re-enter origin and destination
9. Navigate to Review step
10. Verify leg type and configuration are correct

**Expected Results**:
- Smooth transition between leg types
- UI updates appropriately (fields show/hide)
- Data handling is graceful (may clear or retain)
- Final configuration is accurate

**Success Criteria**:
- ✅ Tab switching functional
- ✅ No errors on type change
- ✅ UI updates correctly

---

### Test 2.4: Multiple Legs - Mixed Configuration
**Priority**: Critical  
**Objective**: Create multiple legs with different transport modes and types

**Steps**:
1. Add Leg 1: Ocean transport (CNSHA → USLAX)
2. Add Leg 2: Service-only (Customs Clearance)
3. Add Leg 3: Rail transport (Chicago → Denver)
4. Add Leg 4: Service-only (Warehousing)
5. Add Leg 5: Road transport (Denver → Final Destination)
6. Verify all 5 legs display in correct order
7. Verify leg labels show:
   - "Leg 1 - Ocean Freight"
   - "Leg 2 - Customs Clearance"
   - "Leg 3 - Rail Freight"
   - "Leg 4 - Warehousing"
   - "Leg 5 - Trucking"
8. Navigate to different steps
9. Return to Legs step
10. Verify all legs persist with correct configurations

**Expected Results**:
- Multiple legs with mixed types created successfully
- Leg order maintained
- Leg labels accurate and human-readable
- All data persists across navigation

**Success Criteria**:
- ✅ 5+ legs can be created
- ✅ Mixed transport and service legs work together
- ✅ Data integrity maintained

---

## Phase 3: Charges Management

### Test 3.1: Add Charges to Transport Leg
**Priority**: Critical  
**Objective**: Add multiple charges to a transport leg and verify totals

**Steps**:
1. Navigate to Charges step (step 3)
2. Select Leg 1 (Ocean Freight)
3. Click 'Add Charge'
4. Add Ocean Freight:
   - Charge type: "Freight"
   - Buy rate: $1000
   - Sell rate: $1200
   - Quantity: 1
5. Click 'Add Charge' again
6. Add BAF (Bunker Adjustment):
   - Buy: $50
   - Sell: $60
7. Add CAF (Currency Adjustment):
   - Buy: $30
   - Sell: $40
8. Verify all 3 charges display under Leg 1
9. Verify leg total calculates:
   - Buy: $1080 ($1000 + $50 + $30)
   - Sell: $1300 ($1200 + $60 + $40)

**Expected Results**:
- Multiple charges added to same leg
- Each charge displays with correct values
- Leg total aggregates all charges
- Buy and Sell totals calculate separately

**Success Criteria**:
- ✅ Multiple charges per leg supported
- ✅ Totals calculate correctly
- ✅ No calculation errors

---

### Test 3.2: Add Combined Charges (Non-Leg Specific)
**Priority**: Critical  
**Objective**: Add charges not tied to specific legs (apply to entire option)

**Steps**:
1. In Charges step, scroll to 'Combined Charges' section
2. Click 'Add Combined Charge'
3. Add Insurance:
   - Buy: $100
   - Sell: $120
4. Add Documentation Fee:
   - Buy: $50
   - Sell: $60
5. Add Customs Clearance:
   - Buy: $200
   - Sell: $250
6. Verify all 3 combined charges display
7. Verify combined total:
   - Buy: $350
   - Sell: $430
8. Verify option grand total includes leg totals + combined charges

**Expected Results**:
- Combined charges added successfully
- Combined totals calculate correctly
- Option-level totals include both leg and combined charges

**Success Criteria**:
- ✅ Combined charges functional
- ✅ Separate section from leg charges
- ✅ Aggregation works correctly

---

### Test 3.3: Charge Quantity & Basis
**Priority**: High  
**Objective**: Test quantity and basis fields for charges

**Steps**:
1. Add charge with quantity = 2
2. Enter rate per unit: $50 buy, $60 sell
3. Verify total calculates as:
   - Buy: $100 (2 × $50)
   - Sell: $120 (2 × $60)
4. Select basis: 'Per Container'
5. Change quantity to 5
6. Verify total updates to:
   - Buy: $250 (5 × $50)
   - Sell: $300 (5 × $60)
7. Test with different basis types:
   - Per KG
   - Per CBM
   - Per Shipment
8. Verify calculations update correctly for each basis

**Expected Results**:
- Quantity multiplies rate correctly
- Basis field provides context
- Calculations accurate for all basis types
- UI updates in real-time

**Success Criteria**:
- ✅ Quantity math correct
- ✅ Basis options available
- ✅ Real-time calculation updates

---

### Test 3.4: Auto-Margin Calculation
**Priority**: High  
**Objective**: Test automatic margin application to charges

**Steps**:
1. Enable 'Auto-Margin' toggle in charges section
2. Set margin percentage to 20%
3. Add charge with Buy rate: $100
4. Leave Sell rate empty
5. Verify Sell rate auto-calculates to $125 (not $120)
   - Formula: Sell = Buy / (1 - Margin%)
   - $100 / (1 - 0.20) = $100 / 0.80 = $125
6. Change margin to 15%
7. Verify Sell rate updates to $117.65
8. Add new charge with Buy: $500
9. Verify Sell auto-calculates with 15% margin ($588.24)
10. Disable auto-margin
11. Manually set Sell rate to $600
12. Verify manual rate is preserved (not overridden)

**Expected Results**:
- Auto-margin calculates correct sell rate for target margin
- Formula: Sell = Buy / (1 - Margin%)
- Updates apply to new charges
- Manual overrides respected when auto-margin disabled

**Success Criteria**:
- ✅ Auto-margin formula correct
- ✅ Toggle works as expected
- ✅ Manual overrides possible

---

### Test 3.5: Delete Charge
**Priority**: High  
**Objective**: Delete individual charges from legs

**Steps**:
1. Add 3 charges to Leg 1
2. Note the total before deletion
3. Click delete icon (🗑️) on middle charge
4. Verify delete confirmation dialog appears
5. Confirm deletion
6. Verify charge is removed from UI
7. Verify remaining 2 charges are intact
8. Verify leg total recalculates correctly (excludes deleted charge)
9. Navigate away and back
10. Verify deletion persisted

**Expected Results**:
- Delete confirmation required
- Charge removed from UI and state
- Totals recalculate immediately
- Other charges unaffected
- Deletion persists

**Success Criteria**:
- ✅ Confirmation dialog works
- ✅ Charge deleted successfully
- ✅ Totals update correctly

---

## Phase 4: Option Management

### Test 4.1: Create Multiple Options
**Priority**: Critical  
**Objective**: Create and manage multiple independent quotation options

**Steps**:
1. Complete Option A:
   - Add Ocean + Rail + Truck legs
   - Add charges to all legs
   - Add combined charges
   - Save Option A
2. Create new Option B:
   - Clear previous data
   - Add Air + Truck legs only
   - Add different charges
   - Save Option B
3. Switch between Option A and Option B
4. Verify data isolation:
   - Option A legs ≠ Option B legs
   - Option A charges ≠ Option B charges
   - Totals are independent
5. Open Option A, verify Ocean leg still exists
6. Open Option B, verify Air leg exists (Ocean does not)

**Expected Results**:
- Multiple options created successfully
- Each option has independent configuration
- No data leakage between options
- Option switching works smoothly

**Database Verification**:
```sql
-- Verify multiple options exist for same version
SELECT qvo.id, qvo.option_name, qvo.total_buy, qvo.total_sell
FROM quotation_version_options qvo
WHERE qvo.quotation_version_id = 'cae4cb72-7f05-47be-899e-8e3bb9a6fd83';

-- Expected: 2+ rows (Option A, Option B)
```

**Success Criteria**:
- ✅ Multiple options supported
- ✅ Data isolation maintained
- ✅ Option switching functional

---

### Test 4.2: Option Cost Comparison
**Priority**: High  
**Objective**: Compare costs across different options

**Steps**:
1. Open Review step for Option A
2. Note totals:
   - Total Buy: $X
   - Total Sell: $Y
   - Profit: $Z
   - Margin: W%
3. Switch to Option B
4. Note totals for Option B
5. Compare:
   - Which option has lower buy cost?
   - Which option has higher profit?
   - Which option has better margin?
6. Verify calculations are accurate for both options
7. Identify recommended option based on criteria

**Expected Results**:
- Cost comparison is clear
- All calculations accurate
- Margin percentages correct
- Decision support enabled

**Success Criteria**:
- ✅ Comparison data accessible
- ✅ Calculations verified
- ✅ Business logic sound

---

## Phase 5: Save Operations & Cascade Deletes

### Test 5.1: Save New Quotation Option
**Priority**: Critical  
**Objective**: Save complete quotation with progress tracking

**Steps**:
1. Configure complete option:
   - 3 transport legs
   - 10+ charges across legs
   - 3 combined charges
2. Navigate to Review step
3. Verify all data displayed correctly
4. Click 'Save Quotation' button
5. Observe save progress dialog with steps:
   - ✅ Creating option
   - ✅ Saving legs
   - ✅ Saving charges
   - ✅ Finalizing
6. Wait for success toast: "Quotation saved successfully"
7. Verify save completed without errors
8. Reload page and navigate back to quotation
9. Verify all data loaded correctly

**Expected Results**:
- Save process completes successfully
- Progress tracking shows each step
- Success notification appears
- Data persists to database
- Reload shows saved data

**Database Verification**:
```sql
-- Verify option saved
SELECT * FROM quotation_version_options 
WHERE quotation_version_id = 'cae4cb72-7f05-47be-899e-8e3bb9a6fd83'
ORDER BY created_at DESC LIMIT 1;

-- Verify legs saved
SELECT ql.*, qvol.quotation_version_option_id
FROM quote_legs ql
JOIN quotation_version_option_legs qvol ON ql.id = qvol.quote_leg_id
WHERE qvol.quotation_version_option_id = '[option_id from above]';

-- Verify charges saved
SELECT * FROM quote_charges 
WHERE quote_leg_id IN (SELECT id FROM quote_legs WHERE ...[matching legs]);
```

**Success Criteria**:
- ✅ Save completes without errors
- ✅ Progress tracking works
- ✅ Database records created

---

### Test 5.2: Update Existing Quotation
**Priority**: Critical  
**Objective**: Update and re-save existing quotation

**Steps**:
1. Open existing saved quotation
2. Verify all data loads correctly
3. Make changes:
   - Update charge rate: Freight $1000 → $1100
   - Add new charge to existing leg: "Handling $75"
   - Update origin on Leg 1: "Shanghai" → "Ningbo"
4. Save quotation
5. Verify save progress
6. Verify success notification
7. Reload quotation
8. Verify updates persisted:
   - Freight rate is $1100 (not $1000)
   - Handling charge exists
   - Origin is "Ningbo"
9. Verify no duplicate records created

**Expected Results**:
- Updates save correctly
- No data duplication
- Existing records updated (not duplicated)
- All changes persisted

**Database Verification**:
```sql
-- Verify no duplicate charges
SELECT quote_leg_id, charge_name, COUNT(*) as count
FROM quote_charges
WHERE quote_leg_id = '[leg_id]'
GROUP BY quote_leg_id, charge_name
HAVING COUNT(*) > 1;

-- Expected: 0 rows (no duplicates)
```

**Success Criteria**:
- ✅ Updates save successfully
- ✅ No duplicates created
- ✅ Changes persist correctly

---

### Test 5.3: Delete Leg with Cascade
**Priority**: Critical  
**Objective**: Delete entire leg and verify cascade deletion of charges

**Steps**:
1. Open quotation with 3 legs
2. Note charges on Leg 2 (e.g., 3 charges with specific IDs)
3. Click delete icon on Leg 2
4. Verify confirmation dialog: "Delete this leg and all associated charges?"
5. Confirm deletion
6. Verify Leg 2 removed from UI
7. Verify totals recalculate (excluding Leg 2)
8. Save quotation
9. Query database to verify:
   - Leg 2 deleted from quote_legs
   - All 3 charges deleted from quote_charges
   - quotation_version_option_legs junction record deleted
10. Verify no orphaned charges exist

**Expected Results**:
- Leg deletion removes leg and all charges
- Cascade delete works correctly
- Junction table cleaned up
- No orphaned records
- Totals recalculate correctly

**Database Verification**:
```sql
-- Verify leg deleted
SELECT * FROM quote_legs WHERE id = '[leg_2_id]';
-- Expected: 0 rows

-- Verify charges deleted
SELECT * FROM quote_charges WHERE quote_leg_id = '[leg_2_id]';
-- Expected: 0 rows

-- Verify junction deleted
SELECT * FROM quotation_version_option_legs 
WHERE quote_leg_id = '[leg_2_id]';
-- Expected: 0 rows

-- Check for orphans
SELECT qc.* FROM quote_charges qc
LEFT JOIN quote_legs ql ON qc.quote_leg_id = ql.id
WHERE ql.id IS NULL;
-- Expected: 0 rows (no orphans)
```

**Success Criteria**:
- ✅ Cascade delete works
- ✅ No orphaned records
- ✅ Database integrity maintained

---

## Phase 6: Validation & Error Handling

### Test 6.1: Required Field Validation
**Priority**: High  
**Objective**: Test validation for required fields

**Steps**:
1. Try to save quotation without any legs
2. Verify validation error: "At least one leg is required"
3. Verify save is prevented
4. Add a leg but leave service type empty
5. Try to save
6. Verify validation error about service type
7. Add transport leg without origin/destination
8. Try to save
9. Verify warning or validation message
10. Complete all required fields
11. Verify save succeeds

**Expected Results**:
- Validation prevents incomplete saves
- Clear error messages displayed
- User guided to fix issues
- Save succeeds when valid

**Success Criteria**:
- ✅ Validation rules enforced
- ✅ Error messages clear
- ✅ Save blocked when invalid

---

### Test 6.2: Charge Value Validation
**Priority**: High  
**Objective**: Test validation for charge values

**Steps**:
1. Add charge with negative buy rate (-$50)
2. Verify validation error: "Buy rate must be positive"
3. Add charge with sell rate less than buy rate:
   - Buy: $100
   - Sell: $80
4. Verify warning: "Sell rate is less than buy rate. This will result in negative margin."
5. Add charge with quantity = 0
6. Verify validation error: "Quantity must be greater than 0"
7. Add charge with valid values:
   - Buy: $100
   - Sell: $120
   - Quantity: 1
8. Verify validation passes

**Expected Results**:
- Invalid values rejected
- Warnings for unusual scenarios (sell < buy)
- Positive values required
- Valid charges accepted

**Success Criteria**:
- ✅ Value validation works
- ✅ Warnings displayed
- ✅ Valid data accepted

---

### Test 6.3: Data Persistence After Navigation
**Priority**: High  
**Objective**: Verify data persists when navigating between steps

**Steps**:
1. Add 2 legs in step 2
2. Navigate to step 3 (Charges)
3. Add charges to both legs
4. Navigate back to step 2
5. Verify both legs still present
6. Navigate to step 4 (Review)
7. Verify all data displayed
8. Navigate back to step 3
9. Verify all charges still present
10. Navigate to step 1
11. Make a change to quote details
12. Navigate to step 4
13. Verify all leg and charge data intact

**Expected Results**:
- Data persists across all navigation
- No data loss when switching steps
- State management works correctly
- All steps show consistent data

**Success Criteria**:
- ✅ No data loss on navigation
- ✅ State management robust
- ✅ Consistent data across steps

---

## Phase 7: Cost Calculations

### Test 7.1: Leg-Level Totals
**Priority**: Critical  
**Objective**: Verify leg-level cost aggregation

**Steps**:
1. Add Leg 1 with 3 charges:
   - Charge 1: Buy $100, Sell $120
   - Charge 2: Buy $50, Sell $60
   - Charge 3: Buy $30, Sell $40
2. Verify Leg 1 Total:
   - Buy: $180 ($100 + $50 + $30)
   - Sell: $220 ($120 + $60 + $40)
3. Add Leg 2 with 2 charges:
   - Charge 1: Buy $200, Sell $250
   - Charge 2: Buy $75, Sell $90
4. Verify Leg 2 Total:
   - Buy: $275 ($200 + $75)
   - Sell: $340 ($250 + $90)
5. Verify totals display correctly in UI
6. Update a charge rate and verify leg total updates

**Expected Results**:
- Leg totals = sum of all charges in leg
- Buy and Sell totals calculated separately
- Totals update when charges change
- Calculations accurate

**Success Criteria**:
- ✅ Aggregation correct
- ✅ Real-time updates
- ✅ Math verified

---

### Test 7.2: Option-Level Totals
**Priority**: Critical  
**Objective**: Verify option-level aggregation across legs and combined charges

**Steps**:
1. Use legs from Test 7.1:
   - Leg 1: Buy $180, Sell $220
   - Leg 2: Buy $275, Sell $340
2. Add combined charges:
   - Insurance: Buy $100, Sell $120
   - Documentation: Buy $50, Sell $60
3. Calculate expected option totals:
   - Total Buy = $180 + $275 + $100 + $50 = $605
   - Total Sell = $220 + $340 + $120 + $60 = $740
   - Profit = $740 - $605 = $135
   - Margin = ($135 / $740) × 100 = 18.24%
4. Verify Review step displays exactly these values
5. Add another charge and verify totals update
6. Remove a charge and verify totals update

**Expected Results**:
- Option totals include all legs + combined charges
- Profit = Total Sell - Total Buy
- Margin = (Profit / Total Sell) × 100
- Calculations accurate to 2 decimal places

**Success Criteria**:
- ✅ Option aggregation correct
- ✅ Profit calculation correct
- ✅ Margin formula correct

---

### Test 7.3: Margin Percentage Calculation
**Priority**: High  
**Objective**: Verify margin calculation uses correct formula

**Steps**:
1. Create simple option:
   - Total Buy: $1000
   - Total Sell: $1200
2. Calculate:
   - Profit = $1200 - $1000 = $200
   - Margin = ($200 / $1200) × 100 = 16.67%
   - NOT 20% (common error: $200 / $1000)
3. Verify UI shows 16.67% (not 20%)
4. Create another option:
   - Total Buy: $500
   - Total Sell: $575
5. Calculate:
   - Profit = $75
   - Margin = ($75 / $575) × 100 = 13.04%
6. Verify UI shows 13.04%
7. Test auto-margin scenario:
   - Set margin target: 15%
   - Buy: $1000
   - Calculate required Sell: $1000 / (1 - 0.15) = $1176.47
8. Verify auto-margin calculates correctly

**Expected Results**:
- Margin formula: (Profit / Sell) × 100
- Auto-margin formula: Sell = Buy / (1 - Margin%)
- Calculations use correct denominators
- Percentages display 2 decimal places

**Success Criteria**:
- ✅ Margin formula correct
- ✅ Auto-margin formula correct
- ✅ No calculation errors

---

## Phase 8: Edge Cases & Large Data

### Test 8.1: Empty Option Handling
**Priority**: Medium  
**Objective**: Test behavior with minimal data

**Steps**:
1. Create new option with no legs
2. Try to save
3. Verify validation error prevents save
4. Add one leg with no charges
5. Try to save
6. Verify leg saves successfully
7. Verify option totals show $0/$0
8. Verify profit and margin show $0 or N/A

**Expected Results**:
- Empty options prevented
- Legs without charges allowed
- Zero totals handled gracefully
- No division by zero errors

**Success Criteria**:
- ✅ Validation prevents empty options
- ✅ Zero totals handled
- ✅ No errors on edge cases

---

### Test 8.2: Rapid State Changes
**Priority**: Low  
**Objective**: Test rapid user interactions

**Steps**:
1. Add leg
2. Immediately delete it
3. Add different leg
4. Switch transport mode multiple times quickly
5. Add and delete charges rapidly
6. Navigate between steps quickly
7. Spam click buttons
8. Verify no console errors
9. Verify final state is consistent

**Expected Results**:
- System handles rapid changes gracefully
- No race conditions
- Final state is valid
- No crashes or errors

**Success Criteria**:
- ✅ No errors on rapid interactions
- ✅ State remains consistent
- ✅ UI remains responsive

---

### Test 8.3: Browser Refresh/Reload
**Priority**: High  
**Objective**: Test data persistence on page reload

**Steps**:
1. Configure quotation with 3 legs, 10 charges
2. Save quotation
3. Note quote ID and option ID
4. Press F5 to refresh browser
5. Wait for page reload
6. Navigate to Quotes page
7. Open the quotation by ID
8. Verify all legs load correctly
9. Verify all charges load correctly
10. Make a small change (update one charge)
11. Save again
12. Verify update successful

**Expected Results**:
- Data persists through browser reload
- All data loads from database correctly
- Updates after reload work normally
- No data corruption

**Success Criteria**:
- ✅ Data survives reload
- ✅ No corruption
- ✅ Updates work post-reload

---

### Test 8.4: Large Quotation (10+ Legs)
**Priority**: Medium  
**Objective**: Test system with large data volume

**Steps**:
1. Add 10 legs with different transport modes
2. Add 3-5 charges to each leg (30-50 total)
3. Add 5 combined charges
4. Verify UI remains responsive (no lag)
5. Navigate between steps
6. Verify scroll works smoothly
7. Save quotation
8. Measure save time (should be < 10 seconds)
9. Verify save success
10. Reload quotation
11. Verify all 10 legs load correctly
12. Verify all 30-50 charges load correctly

**Expected Results**:
- System handles large quotations
- UI remains responsive
- Save completes within 10 seconds
- Data loads correctly

**Performance Benchmarks**:
- Load time: < 3 seconds
- Save time: < 10 seconds
- UI lag: < 100ms

**Success Criteria**:
- ✅ Large data supported
- ✅ Performance acceptable
- ✅ No crashes or timeouts

---

## Phase 9: UI/UX Verification

### Test 9.1: Step Navigation
**Priority**: High  
**Objective**: Test workflow stepper navigation

**Steps**:
1. Verify stepper shows all 4 steps at top
2. Verify current step is highlighted
3. Click 'Next' button
4. Verify step advances to next
5. Verify step indicator updates
6. Click 'Back' button
7. Verify step goes back
8. Try clicking on step 4 directly from step 1
9. Verify prevented or allowed based on validation
10. Complete all steps in sequence
11. Verify stepper completion state

**Expected Results**:
- Stepper navigation intuitive
- Current step clearly indicated
- Next/Back buttons functional
- Validation prevents skipping required steps

**Success Criteria**:
- ✅ Navigation works smoothly
- ✅ Visual feedback clear
- ✅ Validation enforced

---

### Test 9.2: Toast Notifications
**Priority**: Medium  
**Objective**: Verify user feedback messages

**Steps**:
1. Add leg → verify toast: "Service Type Auto-Selected"
2. Save successfully → verify toast: "Quotation Saved Successfully"
3. Trigger validation error → verify error toast with message
4. Delete item → verify confirmation dialog (not toast)
5. Update charge → verify success feedback
6. Verify toasts auto-dismiss after 5 seconds
7. Verify error toasts stay longer or require dismiss

**Expected Results**:
- Toasts provide timely feedback
- Success = green toast
- Error = red toast
- Warning = yellow toast
- Toasts auto-dismiss appropriately

**Success Criteria**:
- ✅ All actions have feedback
- ✅ Toast colors appropriate
- ✅ Timing is correct

---

### Test 9.3: Responsive Layout
**Priority**: Low  
**Objective**: Test UI on different screen sizes

**Steps**:
1. Open quotation composer on desktop (1920px)
2. Verify transport mode grid shows 4 columns
3. Verify all cards and inputs visible
4. Resize to tablet (768px)
5. Verify layout adjusts (maybe 2 columns)
6. Verify no horizontal scroll
7. Resize to mobile (375px)
8. Verify single column layout
9. Verify all features accessible
10. Test on actual mobile device if possible

**Expected Results**:
- Responsive breakpoints work
- Layout adapts gracefully
- No broken UI elements
- All features accessible on mobile

**Success Criteria**:
- ✅ Desktop layout optimal
- ✅ Tablet layout functional
- ✅ Mobile layout usable

---

## Phase 10: Database Verification

### Test 10.1: Database Record Verification
**Priority**: Critical  
**Objective**: Verify database records match UI data

**Steps**:
1. Save complete quotation with known test data:
   - 3 legs (Ocean, Rail, Road)
   - 9 charges (3 per leg)
   - 3 combined charges
2. Query database:
```sql
-- Get option
SELECT * FROM quotation_version_options 
WHERE id = '[option_id]';

-- Get legs
SELECT ql.*, qvol.sort_order
FROM quote_legs ql
JOIN quotation_version_option_legs qvol ON ql.id = qvol.quote_leg_id
WHERE qvol.quotation_version_option_id = '[option_id]'
ORDER BY qvol.sort_order;

-- Get leg charges
SELECT qc.* FROM quote_charges qc
WHERE qc.quote_leg_id IN (
  SELECT ql.id FROM quote_legs ql
  JOIN quotation_version_option_legs qvol ON ql.id = qvol.quote_leg_id
  WHERE qvol.quotation_version_option_id = '[option_id]'
)
ORDER BY qc.quote_leg_id, qc.charge_name;

-- Get combined charges
SELECT qc.* FROM quote_charges qc
WHERE qc.quote_leg_id IS NULL 
  AND qc.quotation_version_option_id = '[option_id]';
```
3. Verify all records exist
4. Verify all foreign keys are valid
5. Verify no null required fields
6. Verify charge calculations match UI

**Expected Results**:
- All records present in database
- Foreign keys valid
- Data matches UI exactly
- No data corruption

**Success Criteria**:
- ✅ Database records accurate
- ✅ Relationships valid
- ✅ No data loss

---

### Test 10.2: Orphan Record Prevention
**Priority**: Critical  
**Objective**: Verify no orphaned records after deletions

**Steps**:
1. Create quotation with 5 legs, 15 charges
2. Save to database
3. Delete 2 legs
4. Save again
5. Query for orphaned charges:
```sql
-- Find charges without valid leg
SELECT qc.* FROM quote_charges qc
LEFT JOIN quote_legs ql ON qc.quote_leg_id = ql.id
WHERE qc.quote_leg_id IS NOT NULL AND ql.id IS NULL;
-- Expected: 0 rows

-- Find legs without valid option link
SELECT ql.* FROM quote_legs ql
LEFT JOIN quotation_version_option_legs qvol ON ql.id = qvol.quote_leg_id
WHERE qvol.quote_leg_id IS NULL;
-- Expected: 0 rows
```
6. Delete entire option
7. Verify all legs and charges removed:
```sql
-- Should find no legs
SELECT * FROM quote_legs ql
WHERE ql.id IN (
  SELECT qvol.quote_leg_id 
  FROM quotation_version_option_legs qvol
  WHERE qvol.quotation_version_option_id = '[deleted_option_id]'
);
-- Expected: 0 rows
```

**Expected Results**:
- No orphaned charges exist
- No orphaned legs exist
- Cascade deletes work correctly
- Database integrity maintained

**Success Criteria**:
- ✅ No orphans found
- ✅ Cascade deletes work
- ✅ Referential integrity intact

---

## Test Execution Checklist

### Pre-Test Setup
- [ ] Verify QUO-000002 exists with ID: 471cc5f2-29e5-4015-8bf2-c60ab69df476
- [ ] Verify version ID: cae4cb72-7f05-47be-899e-8e3bb9a6fd83
- [ ] Backup database before testing
- [ ] Document current state:
  - Number of existing options
  - Number of existing legs
  - Number of existing charges
- [ ] Prepare test data spreadsheet
- [ ] Set up browser dev tools
- [ ] Clear browser cache and storage

### During Testing
- [ ] Execute tests sequentially by phase
- [ ] Mark each test as: ✅ Passed | ❌ Failed | ⚠️ Warning
- [ ] Capture screenshots for failed tests
- [ ] Log all errors with timestamps
- [ ] Note any unexpected behavior
- [ ] Verify database state after each major test
- [ ] Check browser console for errors
- [ ] Monitor network tab for failed requests

### Post-Test Verification
- [ ] Review all failed tests
- [ ] Document bugs found
- [ ] Verify no orphaned records in database
- [ ] Check referential integrity
- [ ] Verify all totals are accurate
- [ ] Check audit trail (created_at, updated_at)
- [ ] Performance benchmarks met
- [ ] Create bug report for failures

---

## Success Criteria for Production Release

### Critical Requirements (Must Pass)
1. ✅ **Transport Mode Selection**: All modes display and select correctly
2. ✅ **Service Type Auto-Selection**: Works for all transport modes
3. ✅ **Leg Configuration**: Both transport and service legs work
4. ✅ **Charges Management**: Add, update, delete charges successfully
5. ✅ **Save Operations**: Complete save without data loss
6. ✅ **Cost Calculations**: All totals and margins accurate
7. ✅ **Database Integrity**: No orphaned records, valid relationships
8. ✅ **Cascade Deletes**: Leg deletion removes all charges
9. ✅ **Validation**: Prevents invalid data entry
10. ✅ **Data Persistence**: Survives navigation and reload

### High Priority Requirements (Should Pass)
1. ✅ Service type dropdown filtering
2. ✅ Auto-margin calculations
3. ✅ Multiple options management
4. ✅ Update existing quotations
5. ✅ Large quotations (10+ legs)
6. ✅ Error handling and user feedback

### Medium Priority Requirements (Nice to Have)
1. ⚪ Responsive layout on mobile
2. ⚪ Rapid state change handling
3. ⚪ Performance benchmarks
4. ⚪ Toast notification timing

---

## Known Issues & Workarounds

### Issue 1: Leg Label Showing UUID
**Status**: ✅ RESOLVED  
**Description**: Leg labels were showing UUIDs instead of service type names  
**Root Cause**: Service type lookup was matching by ID instead of using transport_modes relationship  
**Fix**: Updated MultiModalQuoteComposer to use mode code for service type matching

### Issue 2: Service Type Dropdown Empty
**Status**: ✅ RESOLVED  
**Description**: Service type dropdown showing no options for some transport modes  
**Root Cause**: Missing transport_mode_id relationships in database  
**Fix**: Migrated service types to include proper transport_mode_id foreign keys

---

## Test Environment Details

**Application Version**: Latest (2025-11-20)  
**Database**: Supabase (Lovable Cloud)  
**Test Quote**: QUO-000002  
**Test User**: ce4c64f5-cd8c-4d2d-bbbd-04972c4a7768  
**Test Tenant**: 37a4d9ca-626d-4ed3-9e71-5d416e7ccaf8  

**Browser Support**:
- Chrome 120+
- Firefox 120+
- Safari 17+
- Edge 120+

**Screen Sizes Tested**:
- Desktop: 1920×1080
- Tablet: 768×1024
- Mobile: 375×667

---

## Appendix: SQL Verification Queries

```sql
-- Verify transport modes
SELECT * FROM transport_modes WHERE is_active = true;

-- Verify service types with transport modes
SELECT st.name, tm.name as transport_mode
FROM service_types st
LEFT JOIN transport_modes tm ON st.transport_mode_id = tm.id
WHERE st.is_active = true;

-- Verify quotation structure
SELECT 
  q.quote_number,
  qv.version_name,
  qvo.option_name,
  qvo.total_buy,
  qvo.total_sell,
  qvo.profit,
  qvo.margin_percentage
FROM quotes q
JOIN quotation_versions qv ON q.id = qv.quote_id
JOIN quotation_version_options qvo ON qv.id = qvo.quotation_version_id
WHERE q.id = '471cc5f2-29e5-4015-8bf2-c60ab69df476';

-- Verify legs and charges
SELECT 
  ql.id as leg_id,
  st.name as service_type,
  COUNT(qc.id) as charge_count,
  SUM(qc.buy_rate * qc.quantity) as leg_buy_total,
  SUM(qc.sell_rate * qc.quantity) as leg_sell_total
FROM quote_legs ql
JOIN service_types st ON ql.service_type_id = st.id
LEFT JOIN quote_charges qc ON ql.id = qc.quote_leg_id
GROUP BY ql.id, st.name;

-- Check for orphaned records
SELECT 'Orphaned Charges' as issue_type, COUNT(*) as count
FROM quote_charges qc
LEFT JOIN quote_legs ql ON qc.quote_leg_id = ql.id
WHERE qc.quote_leg_id IS NOT NULL AND ql.id IS NULL

UNION ALL

SELECT 'Orphaned Legs', COUNT(*)
FROM quote_legs ql
LEFT JOIN quotation_version_option_legs qvol ON ql.id = qvol.quote_leg_id
WHERE qvol.quote_leg_id IS NULL;
```

---

**Test Plan Version**: 2.0  
**Last Updated**: 2025-11-20  
**Status**: Ready for Execution
