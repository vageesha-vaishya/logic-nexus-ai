
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFK() {
  const { data, error } = await supabase.from('aes_hts_codes').select('global_hs_root_id').not('global_hs_root_id', 'is', null).limit(1);
  if (error) {
      console.log('Error checking FK:', error.message);
  } else {
      console.log('FK populated count (sample):', data?.length);
  }
}

checkFK();
