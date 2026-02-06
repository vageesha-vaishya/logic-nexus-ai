import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRefData() {
  const { data: modes, error: modeError } = await supabase.from('transport_modes').select('*');
  if (modeError) console.error('Mode Error:', modeError);
  else console.log('Modes:', modes?.length, modes?.map(m => m.name));

  const { data: carriers, error: carrierError } = await supabase.from('carriers').select('*');
  if (carrierError) console.error('Carrier Error:', carrierError);
  else console.log('Carriers:', carriers?.length);
}

checkRefData();
