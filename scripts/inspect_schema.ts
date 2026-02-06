
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Polyfill for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkColumns() {
  console.log('Checking schema for quotation_version_options...');
  
  // We can't query information_schema easily with just the JS client unless we have a specific RPC or raw SQL access.
  // But we can try to select * from the table with limit 0 and see the structure, or rely on the error message we just got.
  // The error "Could not find the 'source_attribution' column" is pretty definitive.
  
  // Let's try to list columns by inserting a dummy record with only known columns and selecting *
  // OR we can use the 'rpc' if available.
  
  // For now, let's just confirm what IS there.
  const { data, error } = await supabase
    .from('quotation_version_options')
    .select('*')
    .limit(1);
    
  if (data && data.length > 0) {
    console.log('Existing columns:', Object.keys(data[0]));
  } else {
    console.log('No data found, cannot infer columns from result.');
    console.log('Error if any:', error);
  }
}

checkColumns();
