
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCarrierTypes() {
  const { data, error } = await supabase
    .from('carriers')
    .select('carrier_type')
    .limit(100);

  if (error) {
    console.error('Error fetching carriers:', error);
    return;
  }

  const types = new Set(data.map(c => c.carrier_type));
  console.log('Distinct carrier types in DB:', [...types]);
}

checkCarrierTypes();
