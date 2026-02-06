
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function dumpTable() {
  const { data, error } = await supabase.from('global_hs_roots').select('*').limit(1);
  if (error) {
      console.log('Error selecting *:', error.message);
  } else {
      console.log('Table data:', data);
      if (data && data.length > 0) {
          console.log('Columns:', Object.keys(data[0]));
      }
  }
}

dumpTable();
