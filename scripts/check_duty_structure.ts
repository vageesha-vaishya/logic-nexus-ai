
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDutyCalculation() {
  console.log('Checking Duty Calculation...');

  const cargoItems = [
    {
        hts_code: '8517.62.00', // Example HTS
        value: 10000,
        quantity: 1
    }
  ];

  const { data, error } = await supabase.rpc('calculate_duty', {
    p_origin_country: 'CN',
    p_destination_country: 'US',
    p_service_type: 'ocean_freight',
    p_items: cargoItems
  });

  if (error) {
    console.error('calculate_duty failed:', error);
  } else {
    console.log('Calculation Result:', JSON.stringify(data, null, 2));
  }
}

checkDutyCalculation();
