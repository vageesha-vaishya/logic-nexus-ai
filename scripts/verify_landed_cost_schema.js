
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or ANON KEY) are required.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifySchema() {
  console.log('Verifying Landed Cost Engine Schema...');

  // 1. Check tax_definitions table
  const { data: taxes, error: taxError } = await supabase
    .from('tax_definitions')
    .select('*');

  if (taxError) {
    console.error('Error fetching tax_definitions:', taxError.message);
  } else {
    console.log(`✅ tax_definitions table exists. Found ${taxes.length} records.`);
    console.log('Sample taxes:', taxes.map(t => t.code));
  }

  // 2. Check duty_rates table
  const { data: duties, error: dutyError } = await supabase
    .from('duty_rates')
    .select('*')
    .limit(5);

  if (dutyError) {
    console.error('Error fetching duty_rates:', dutyError.message);
  } else {
    console.log(`✅ duty_rates table exists. Found ${duties.length} (limit 5) records.`);
  }

  // 3. Test calculate_landed_cost RPC
  const payload = {
    items: [
      { hs_code: '8517130000', value: 1000, quantity: 10, weight: 5, origin_country: 'CN' }
    ],
    destination_country: 'US'
  };

  const { data: landedCost, error: rpcError } = await supabase
    .rpc('calculate_landed_cost', payload);

  if (rpcError) {
    console.error('Error calling calculate_landed_cost:', rpcError.message);
  } else {
    console.log('✅ calculate_landed_cost RPC working.');
    console.log('Result:', JSON.stringify(landedCost, null, 2));
  }
}

verifySchema();
