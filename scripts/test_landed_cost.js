
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testLandedCost() {
  console.log('Starting Landed Cost Engine Verification...');

  // 1. Seed Test Duty Rates
  console.log('\n1. Seeding Test Duty Rates...');
  const testRates = [
    {
      jurisdiction: 'UK',
      hs_code: '610910',
      rate_type: 'ad_valorem',
      ad_valorem_rate: 0.12, // 12%
      effective_date: new Date().toISOString()
    },
    {
      jurisdiction: 'US',
      hs_code: '610910',
      rate_type: 'ad_valorem',
      ad_valorem_rate: 0.16, // 16%
      effective_date: new Date().toISOString()
    }
  ];

  const { data: insertedRates, error: seedError } = await supabase
    .from('duty_rates')
    .upsert(testRates, { onConflict: 'id' }) // Ideally verify conflict on jurisdiction/hs_code if constraint exists
    .select();

  if (seedError) {
    console.error('Error seeding duty rates:', seedError);
    // Continue anyway, maybe they exist?
  } else {
    console.log(`Seeded ${insertedRates.length} duty rates.`);
  }

  // 2. Test UK Shipment (VAT + Duty)
  console.log('\n2. Testing UK Shipment (Duty + VAT)...');
  const ukItems = [
    {
      hs_code: '610910',
      value: 1000,
      quantity: 100,
      weight: 50,
      origin_country: 'CN'
    }
  ];

  const { data: ukResult, error: ukError } = await supabase
    .rpc('calculate_landed_cost', {
      items: ukItems,
      destination_country: 'UK'
    });

  if (ukError) {
    console.error('RPC Error (UK):', ukError);
  } else {
    console.log('UK Result:', JSON.stringify(ukResult, null, 2));
    
    // Validation
    const duty = ukResult.total_duty;
    const tax = ukResult.total_tax;
    const fees = ukResult.total_fees;
    
    const expectedDuty = 1000 * 0.12; // 120
    const expectedTax = (1000 + expectedDuty + fees) * 0.20; // (1120) * 0.20 = 224
    
    console.log(`Validation:`);
    console.log(`- Duty: Got ${duty}, Expected ${expectedDuty} (${duty === expectedDuty ? 'PASS' : 'FAIL'})`);
    console.log(`- Tax (VAT): Got ${tax}, Expected ${expectedTax} (${Math.abs(tax - expectedTax) < 0.01 ? 'PASS' : 'FAIL'})`);
  }

  // 3. Test US Shipment (Duty + MPF + HMF)
  console.log('\n3. Testing US Shipment (Duty + MPF + HMF)...');
  const usItems = [
    {
      hs_code: '610910',
      value: 1000,
      quantity: 100,
      weight: 50,
      origin_country: 'CN'
    }
  ];

  const { data: usResult, error: usError } = await supabase
    .rpc('calculate_landed_cost', {
      items: usItems,
      destination_country: 'US'
    });

  if (usError) {
    console.error('RPC Error (US):', usError);
  } else {
    console.log('US Result:', JSON.stringify(usResult, null, 2));

    // Validation
    const duty = usResult.total_duty;
    const fees = usResult.total_fees;
    const tax = usResult.total_tax; // Should be 0
    
    const expectedDuty = 1000 * 0.16; // 160
    
    // MPF: 0.3464% of 1000 = 3.46. Min is 31.67. So 31.67.
    // HMF: 0.125% of 1000 = 1.25.
    const expectedFees = 31.67 + 1.25; // 32.92
    
    console.log(`Validation:`);
    console.log(`- Duty: Got ${duty}, Expected ${expectedDuty} (${duty === expectedDuty ? 'PASS' : 'FAIL'})`);
    console.log(`- Fees: Got ${fees}, Expected ${expectedFees} (${Math.abs(fees - expectedFees) < 0.01 ? 'PASS' : 'FAIL'})`);
    console.log(`- Tax: Got ${tax}, Expected 0 (${tax === 0 ? 'PASS' : 'FAIL'})`);
  }
  
  // Cleanup (Optional, leaving for debugging)
  // await supabase.from('duty_rates').delete().in('hs_code', ['610910']);
}

testLandedCost();
