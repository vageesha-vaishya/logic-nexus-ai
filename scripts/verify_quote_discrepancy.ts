
import { mapOptionToQuote } from '../src/lib/quote-mapper';

// Mock data simulating a Quick Quote result
const mockQuoteOption = {
  id: 'test-opt-1',
  carrier_name: 'Test Carrier',
  total_amount: 1000.50, // Total price presented to user
  currency: 'USD',
  service_type: 'Port to Port',
  charges: [
    { category: 'Freight', amount: 900.00, currency: 'USD' },
    { category: 'Fuel', amount: 100.00, currency: 'USD' }
  ]
};

// Test Case 1: Discrepancy > 0.01
// Total is 1000.50, Charges sum is 1000.00 -> Discrepancy is 0.50
// Expected: Should add a balancing charge of 0.50
function testBalancingCharge() {
  console.log('Running Test Case 1: Balancing Charge Threshold > 0.01');
  
  const mapped = mapOptionToQuote({
    carrier: mockQuoteOption.carrier_name,
    price: mockQuoteOption.total_amount,
    currency: mockQuoteOption.currency,
    serviceType: mockQuoteOption.service_type,
    charges: mockQuoteOption.charges
  } as any);

  // Charges might be in global charges OR in the first leg (synthetic leg)
  let allCharges = mapped.charges || [];
  if (mapped.legs && mapped.legs.length > 0) {
      mapped.legs.forEach((leg: any) => {
          if (leg.charges) allCharges = [...allCharges, ...leg.charges];
      });
  }

  const adjustment = allCharges.find((c: any) => c.category === 'Adjustment' || c.name === 'Ancillary Fees');
  
  if (adjustment && adjustment.amount === 0.50) {
    console.log('PASS: Balancing charge added correctly (0.50)');
  } else {
    console.error('FAIL: Balancing charge missing or incorrect', adjustment);
    console.log('All Charges:', allCharges);
  }
}

// Test Case 2: Rounding Precision
// Simulate a floating point error scenario
// Total 100.00, Charges sum 99.99999999
// Expected: Discrepancy 0.00000001 -> Should be ignored if < 0.01, OR handled gracefully if we strictly want match.
// But wait, my fix was Math.abs(discrepancy) > 0.01.
// Let's test a case where it SHOULD appear: 100.02 vs 100.00
function testRounding() {
    console.log('Running Test Case 2: Rounding Precision');
    const total = 100.02;
    const charges = [{ amount: 100.00 }];
    
    const mapped = mapOptionToQuote({
        price: total,
        charges: charges
    } as any);

    let allCharges = mapped.charges || [];
    if (mapped.legs && mapped.legs.length > 0) {
        mapped.legs.forEach((leg: any) => {
            if (leg.charges) allCharges = [...allCharges, ...leg.charges];
        });
    }

    const adjustment = allCharges.find((c: any) => c.category === 'Adjustment' || c.name === 'Ancillary Fees');
    
    // Discrepancy is 0.02. Should be added.
    if (adjustment && adjustment.amount === 0.02) {
        console.log('PASS: Small discrepancy (0.02) handled correctly');
    } else {
        console.error('FAIL: Small discrepancy handling failed', adjustment);
        console.log('All Charges:', allCharges);
    }
}

// Test Case 3: Very small discrepancy (floating point noise)
// Total 100.00, Charges 99.994 (diff 0.006)
// Expected: Ignored (threshold 0.01)
function testIgnoredDiscrepancy() {
    console.log('Running Test Case 3: Ignored Discrepancy (< 0.01)');
    const total = 100.00;
    const charges = [{ amount: 99.994 }];
    
    const mapped = mapOptionToQuote({
        price: total,
        charges: charges
    } as any);

    const adjustment = mapped.charges.find((c: any) => c.category === 'Adjustment');
    
    if (!adjustment) {
        console.log('PASS: Micro discrepancy ignored correctly');
    } else {
        console.error('FAIL: Micro discrepancy should be ignored', adjustment);
    }
}

testBalancingCharge();
testRounding();
testIgnoredDiscrepancy();
