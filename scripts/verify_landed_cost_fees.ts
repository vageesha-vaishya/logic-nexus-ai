
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env explicitly
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key Length:', supabaseKey.length);

if (!supabaseKey) {
  console.error('ERROR: Supabase Key is missing from .env file.');
  console.log('Available Env Vars:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyLandedCost() {
  console.log('Verifying Landed Cost Engine (MPF/HMF)...');

  // 1. Define test items
  const items = [
    {
      hts_code: '8501.10.4040', // Example HTS
      value: 10000,
      quantity: 10,
      currency: 'USD'
    }
  ];

  const origin = 'CN';
  const destination = 'US';
  const serviceType = 'ocean'; // triggers HMF

  console.log('Calling calculate_duty with:', { origin, destination, serviceType, items });

  const { data, error } = await supabase.rpc('calculate_duty', {
    p_origin_country: origin,
    p_destination_country: destination,
    p_service_type: serviceType,
    p_items: items
  });

  if (error) {
    console.error('Error calling calculate_duty:', error);
    return;
  }

  console.log('Result:', JSON.stringify(data, null, 2));

  // Validation
  const breakdown = data.breakdown[0];
  const mpf = breakdown.mpf;
  const hmf = breakdown.hmf;
  
  // MPF: 0.3464% of 10000 = 34.64. Min 31.67, Max 614.35.
  // 34.64 is within range.
  const expectedMpf = 34.64;
  // HMF: 0.125% of 10000 = 12.50.
  const expectedHmf = 12.50;

  console.log(`Expected MPF: ${expectedMpf}, Got: ${mpf}`);
  console.log(`Expected HMF: ${expectedHmf}, Got: ${hmf}`);

  if (Math.abs(mpf - expectedMpf) < 0.01 && Math.abs(hmf - expectedHmf) < 0.01) {
    console.log('SUCCESS: MPF and HMF calculations are correct.');
  } else {
    console.error('FAILURE: MPF or HMF calculations mismatch.');
  }
}

verifyLandedCost();
