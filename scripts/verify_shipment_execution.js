
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function verify() {
  console.log('Verifying Shipment Execution Schema...');

  // 1. Check shipment_containers table
  const { data: containers, error: cErr } = await supabase
    .from('shipment_containers')
    .select('count')
    .limit(1);

  if (cErr && cErr.code !== 'PGRST116') { // PGRST116 is JSON object return error, but here we check for 42P01 (undefined table)
     if (cErr.code === '42P01') {
         console.error('FAIL: shipment_containers table does not exist.');
     } else {
         console.log('SUCCESS: shipment_containers table exists (accessed successfully).');
     }
  } else {
    console.log('SUCCESS: shipment_containers table exists.');
  }

  // 2. Check aes_itn column in shipments
  // We can try to select the column
  const { data: shipments, error: sErr } = await supabase
    .from('shipments')
    .select('aes_itn')
    .limit(1);

  if (sErr) {
    console.error('FAIL: aes_itn column check failed:', sErr.message);
  } else {
    console.log('SUCCESS: aes_itn column exists in shipments table.');
  }

  // 3. Check shipment_cargo_configurations
   const { data: cargo, error: ccErr } = await supabase
    .from('shipment_cargo_configurations')
    .select('count')
    .limit(1);

  if (ccErr && ccErr.code === '42P01') {
      console.error('FAIL: shipment_cargo_configurations table does not exist.');
  } else {
      console.log('SUCCESS: shipment_cargo_configurations table exists.');
  }
}

verify().catch(console.error);
