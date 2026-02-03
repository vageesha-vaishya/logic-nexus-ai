
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('shipments')
    .select('*')
    .limit(1);

  if (error) {
    console.error(error);
  } else if (data && data.length > 0) {
    console.log('Shipment Keys:', Object.keys(data[0]).sort());
  } else {
    console.log('No shipments found.');
  }
}

run();
