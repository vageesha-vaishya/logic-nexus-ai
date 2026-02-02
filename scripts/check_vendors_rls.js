
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRLS() {
  console.log('Checking RLS Policies for vendors table...');
  
  // We can't query pg_policies directly via client unless we are superuser or use rpc.
  // Instead, we will try to fetch vendors as an anonymous user (should fail or return nothing if secure)
  // and as a signed in user (we can't easily simulate sign-in here without credentials).
  
  // However, we can check if the table exists and if we can read from it.
  
  const { data, error } = await supabase.from('vendors').select('count');
  
  if (error) {
    console.error('Error querying vendors:', error);
  } else {
    console.log('Query result (anon):', data);
  }

  // Check if we have an RPC to inspect policies (custom)
  // If not, we will rely on previous knowledge that I applied RLS.
}

checkRLS();
