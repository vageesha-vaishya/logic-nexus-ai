
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEnum() {
  const { data, error } = await supabase.rpc('get_database_enums');
  
  if (error) {
    // If RPC not available, try to insert invalid value to get error with hints (if enabled)
    // But we saw error didn't give hints.
    // Try raw query if possible (not possible with supabase-js client unless via RPC)
    console.error('Error fetching enums via RPC:', error);
    
    // Try to infer from successful inserts?
    // We know 'ocean' and 'courier' are valid.
    return;
  }
  
  const transportMode = data.find(e => e.enum_type === 'transport_mode');
  console.log('transport_mode enum values:', transportMode);
}

checkEnum();
