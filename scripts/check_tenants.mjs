import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTenants() {
  // Try tenants table
  const { data: tenants, error } = await supabase.from('tenants').select('id, name');
  if (error) {
     console.log('Error fetching tenants:', error.message);
     // Try franchises table
     const { data: franchises, error: fError } = await supabase.from('franchises').select('id, name');
     if (fError) console.log('Error fetching franchises:', fError.message);
     else console.log('Franchises:', franchises);
  } else {
    console.log('Tenants:', tenants);
  }
}

checkTenants();
