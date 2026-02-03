
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testDuty() {
  const htsCode = '8517.62.00';
  const country = 'US';
  const value = 1000;

  console.log(`Testing calculate_duty('${htsCode}', '${country}', ${value})`);

  const { data, error } = await supabase.rpc('calculate_duty', {
    p_hts_code: htsCode,
    p_destination_country: country,
    p_customs_value: value
  });

  if (error) {
    console.error('RPC Error:', error);
  } else {
    console.log('RPC Result:', data);
  }

  // Also check if HTS code exists
  const { data: hts } = await supabase.from('aes_hts_codes').select('*').eq('hts_code', htsCode);
  console.log('HTS Code in DB:', hts);

  // Check rates
  if (hts && hts.length > 0) {
    const { data: rates } = await supabase.from('duty_rates')
        .select('*')
        .eq('aes_hts_id', hts[0].id)
        .eq('country_code', country);
    console.log('Rates in DB:', rates);
  }
}

testDuty().catch(console.error);
