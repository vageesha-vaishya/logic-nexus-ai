
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testDutyCalculation() {
  console.log('Testing Duty Calculation RPC...');

  // 1. Get an HTS code that has a rate
  const { data: rates, error: rateError } = await supabase
    .from('duty_rates')
    .select('country_code, aes_hts_codes(hts_code)')
    .limit(1);

  if (rateError || !rates || rates.length === 0) {
    console.error('No duty rates found to test with.');
    return;
  }

  const testRate = rates[0];
  const htsCode = (testRate.aes_hts_codes as any)?.hts_code;
  const destCountry = testRate.country_code;

  console.log(`Testing with HTS: ${htsCode} -> ${destCountry}`);

  // 2. Call RPC
  const { data, error } = await supabase.rpc('calculate_duty', {
    p_origin_country: 'CN', // Arbitrary origin
    p_destination_country: destCountry,
    p_items: [{
      hts_code: htsCode,
      value: 1000,
      quantity: 1,
      currency: 'USD'
    }]
  });

  if (error) {
    console.error('RPC Error:', error);
  } else {
    console.log('RPC Result:', JSON.stringify(data, null, 2));
    if (data.total_duty >= 0) {
        console.log("SUCCESS: Duty calculated.");
    } else {
        console.log("FAILURE: Invalid duty result.");
    }
  }
}

testDutyCalculation().catch(console.error);
