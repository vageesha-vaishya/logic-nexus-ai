
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from project root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCarrierTypes() {
  const { data, error } = await supabase
    .from('carriers')
    .select('carrier_type, carrier_name');

  if (error) {
    console.error('Error fetching carriers:', error);
    return;
  }

  const types = new Set(data.map(c => c.carrier_type));
  console.log('Distinct carrier types:', Array.from(types));
  
  // Sample carriers per type
  const samples = {};
  data.forEach(c => {
      if (!samples[c.carrier_type]) {
          samples[c.carrier_type] = [];
      }
      if (samples[c.carrier_type].length < 3) {
          samples[c.carrier_type].push(c.carrier_name);
      }
  });
  console.log('Sample carriers:', samples);
}

checkCarrierTypes();
