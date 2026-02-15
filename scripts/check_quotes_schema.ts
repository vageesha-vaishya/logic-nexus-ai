
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTableSchema() {
  console.log('Checking quotes table schema...');
  
  // We can't query information_schema easily with supabase-js client unless we have a function for it
  // or use the rpc if available.
  // Instead, let's try to select * from quotes limit 1 and see the keys.
  
  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching quotes:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Columns found in quotes table:');
    console.log(Object.keys(data[0]).sort());
  } else {
    console.log('No data in quotes table to infer columns from. Trying to insert a dummy to see errors if possible, or just relying on error messages.');
    // If no data, we can't easily see columns without admin access or schema introspection RPC.
    // However, we know from previous error that shipping_term_id was missing.
  }
}

checkTableSchema();
