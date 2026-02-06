import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables. URL:', supabaseUrl, 'Key:', supabaseKey ? 'Found' : 'Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCarriers() {
  const { data: carriers, error } = await supabase
    .from('carriers')
    .select('id, carrier_name, mode, carrier_type');

  if (error) {
    console.error('Error fetching carriers:', error);
    return;
  }

  console.log('Total carriers:', carriers.length);
  
  const modes = [...new Set(carriers.map(c => c.mode))];
  console.log('Available modes:', modes);

  const byMode = {};
  carriers.forEach(c => {
    const m = c.mode || 'unknown';
    if (!byMode[m]) byMode[m] = 0;
    byMode[m]++;
  });
  console.log('Carriers by mode:', byMode);
}

checkCarriers();
