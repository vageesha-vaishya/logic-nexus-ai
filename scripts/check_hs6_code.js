
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  // Check if hs6_code exists
  const { data, error } = await supabase.from('global_hs_roots').select('hs6_code').limit(1);
  if (error) {
      console.log('Error checking hs6_code:', error.message);
  } else {
      console.log('hs6_code exists. Sample:', data);
  }
}

checkColumns();
