
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

async function seedDutyRates() {
  console.log('Seeding Duty Rates...');

  // 1. Get some existing HTS codes
  const { data: htsCodes, error: htsError } = await supabase
    .from('aes_hts_codes')
    .select('id, hts_code')
    .limit(10);

  if (htsError || !htsCodes || htsCodes.length === 0) {
    console.error('Error fetching HTS codes or no codes found:', htsError);
    return;
  }

  console.log(`Found ${htsCodes.length} HTS codes. Generating rates...`);

  const rates = [];
  const destinations = ['US', 'CN', 'DE', 'GB'];

  for (const hts of htsCodes) {
    for (const dest of destinations) {
      // 50% chance to have a rate
      if (Math.random() > 0.5) {
        rates.push({
          aes_hts_id: hts.id,
          country_code: dest,
          rate_type: Math.random() > 0.8 ? 'FTA' : 'MFN',
          rate_value: Number((Math.random() * 0.2).toFixed(4)), // 0% to 20%
          currency: 'USD',
          source: 'Seeded Script'
        });
      }
    }
  }

  if (rates.length === 0) {
    console.log('No rates generated (random chance).');
    return;
  }

  // 2. Insert Rates
  const { error: insertError } = await supabase
    .from('duty_rates')
    .insert(rates);

  if (insertError) {
    console.error('Error inserting duty rates:', insertError);
  } else {
    console.log(`Successfully inserted ${rates.length} duty rates.`);
  }
}

seedDutyRates().catch(console.error);
