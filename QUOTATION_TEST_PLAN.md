# Quotation Testing Plan - QUO-000002

## Current State Analysis
- **Quote Number**: QUO-000002
- **Quote ID**: 471cc5f2-29e5-4015-8bf2-c60ab69df476
- **Status**: pricing_review
- **Current Version**: Version 1 (Draft)
- **Options**: None created yet
- **Legs**: None
- **Charges**: None

## Test Scenarios

### Phase 1: Initial Option Creation (INSERT Operations)
**Goal**: Create first option with complete data

#### Test 1.1: Create Option A with Multiple Legs
- Create quotation version option "Option A"
- Add 3 transport legs:
  - Leg 1: Ocean freight (Origin → Port)
  - Leg 2: Rail transport (Port → Warehouse)
  - Leg 3: Truck delivery (Warehouse → Destination)
- Add charges to each leg:
  - Leg 1: Freight charge, BAF, CAF
  - Leg 2: Rail freight, terminal handling
  - Leg 3: Delivery charge, fuel surcharge
- Add combined charges (not leg-specific):
  - Insurance, documentation fees, customs clearance
- **Expected**: All inserts succeed, relationships maintained

#### Test 1.2: Create Option B with Different Configuration
- Create quotation version option "Option B"
- Add 2 transport legs:
  - Leg 1: Air freight (Origin → Destination)
  - Leg 2: Truck delivery (Airport → Final)
- Add charges with different buy/sell rates
- **Expected**: Multiple options coexist independently

### Phase 2: Update Operations (UPDATE Existing Data)
**Goal**: Modify existing legs and charges

#### Test 2.1: Update Leg Details
- Modify Leg 1 in Option A:
  - Change carrier
  - Update departure/arrival dates
  - Modify origin/destination locations
- **Expected**: Leg updates without affecting charges

#### Test 2.2: Update Charge Rates
- Modify buy rates on existing charges
- Modify sell rates on existing charges
- Update quantity/basis
- **Expected**: Cost calculations recalculate correctly

#### Test 2.3: Update Combined Charges
- Modify insurance amount
- Change documentation fee
- **Expected**: Option totals update correctly

### Phase 3: Mixed Operations (INSERT + UPDATE)
**Goal**: Add new items while modifying existing

#### Test 3.1: Add Leg to Existing Option
- Add Leg 4 to Option A (barge transport)
- Add charges to new leg
- Keep existing legs unchanged
- **Expected**: New leg added, old legs preserved

#### Test 3.2: Add Charges to Existing Leg
- Add 2 new charges to Leg 1
- Keep existing charges on Leg 1
- **Expected**: All charges coexist, totals update

#### Test 3.3: Update Some, Add Some
- Update Leg 1 carrier
- Add new Leg 4
- Update charges on Leg 2
- Add new combined charge
- **Expected**: Mixed operations succeed atomically

### Phase 4: Delete Operations (CASCADE Cleanup)
**Goal**: Test deletion and orphan cleanup

#### Test 4.1: Delete Entire Leg
- Delete Leg 2 from Option A
- **Expected**: 
  - Leg deleted from quote_legs
  - All associated charges deleted
  - quotation_version_option_legs entry removed
  - Option totals recalculate

#### Test 4.2: Delete Individual Charges
- Delete 1 charge from Leg 1
- Delete 1 combined charge
- **Expected**: 
  - Charges removed
  - Leg remains intact
  - Totals recalculate

#### Test 4.3: Delete Multiple Items
- Delete Leg 3
- Delete 2 charges from Leg 1
- Update 1 charge rate
- **Expected**: All operations succeed, data consistent

### Phase 5: Edge Cases & Complex Scenarios
**Goal**: Test boundary conditions and complex workflows

#### Test 5.1: Empty Option Handling
- Create Option C with no legs
- Save quotation
- **Expected**: Option created, validation warnings shown

#### Test 5.2: Leg with No Charges
- Create Leg without any charges
- **Expected**: Leg saved, zero cost calculated

#### Test 5.3: Massive Update
- Update all legs (3 legs)
- Update all charges (10+ charges)
- Add 2 new legs
- Add 5 new charges
- Delete 1 leg
- **Expected**: All operations complete, consistency maintained

#### Test 5.4: Rapid Save/Cancel
- Make changes
- Start save
- Cancel operation
- Make different changes
- Save again
- **Expected**: No orphaned data, correct final state

### Phase 6: Validation & Error Handling
**Goal**: Test validation rules and error recovery

#### Test 6.1: Invalid Data
- Try to save leg with missing required fields
- Try to save charge with negative rate
- **Expected**: Validation errors shown, save prevented

#### Test 6.2: Concurrent Modifications
- Simulate two users editing same quotation
- **Expected**: Last write wins or conflict detection

#### Test 6.3: Network Failure Simulation
- Start save operation
- Simulate network interruption
- **Expected**: Rollback or retry mechanism

### Phase 7: Cost Calculation Verification
**Goal**: Verify all financial calculations

#### Test 7.1: Leg-Level Totals
- Verify buy cost = sum of leg's buy charges
- Verify sell cost = sum of leg's sell charges
- **Expected**: Accurate aggregation

#### Test 7.2: Option-Level Totals
- Verify option buy = sum of all legs + combined charges (buy)
- Verify option sell = sum of all legs + combined charges (sell)
- Verify profit = sell - buy
- Verify margin = (profit / sell) × 100
- **Expected**: All calculations correct

#### Test 7.3: Multi-Currency Handling
- Add charges in different currencies
- **Expected**: Proper conversion or error handling

## Test Execution Checklist

### Pre-Test Setup
- [ ] Verify QUO-000002 exists
- [ ] Backup current state
- [ ] Document initial database state

### During Testing
- [ ] Execute each scenario sequentially
- [ ] Capture database state before/after each test
- [ ] Log all errors and warnings
- [ ] Verify UI reflects database changes
- [ ] Check console for errors

### Post-Test Verification
- [ ] Verify no orphaned records in quote_legs
- [ ] Verify no orphaned records in quote_charges
- [ ] Verify no orphaned records in quotation_version_option_legs
- [ ] Verify referential integrity maintained
- [ ] Verify cost calculations accurate
- [ ] Check audit trail (created_at, updated_at timestamps)

## Success Criteria

1. **Data Integrity**: No orphaned records, all foreign keys valid
2. **Calculation Accuracy**: All totals match expected values
3. **UI Consistency**: UI reflects database state accurately
4. **Error Handling**: Graceful failure with user feedback
5. **Performance**: Save operations complete within acceptable time
6. **Rollback**: Failed operations don't leave partial data

## Test Environment
- **Quote**: QUO-000002
- **Tenant**: 37a4d9ca-626d-4ed3-9e71-5d416e7ccaf8
- **User**: ce4c64f5-cd8c-4d2d-bbbd-04972c4a7768
- **Database**: Production/Staging (specify)

## Notes
- Each test should be independent and repeatable
- Use consistent test data for reproducibility
- Document any deviations from expected behavior
- Capture screenshots for UI verification
