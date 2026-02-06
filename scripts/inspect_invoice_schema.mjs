
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env vars
const envPath = join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  console.log('Inspecting invoice_line_items schema...');
  
  // We can't directly query schema info easily via JS client without admin rights or rpc, 
  // but we can try to select * limit 1 and look at keys, or check if specific columns exist.
  // A better way is to use the `information_schema` if RLS allows, but usually it doesn't for anon.
  // However, we can use the "select" error message trick or just check if columns exist by selecting them.
  
  const { data, error } = await supabase
    .from('invoice_line_items')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error selecting from invoice_line_items:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Columns found in a row:', Object.keys(data[0]));
  } else {
    console.log('No data found, trying to insert/update to probe or assuming standard columns.');
    // Fallback: check columns by selecting specific ones we care about
    const { error: colError } = await supabase
        .from('invoice_line_items')
        .select('container_type_id, container_size_id')
        .limit(1);
        
    if (colError) {
        console.log('Specific container columns check result:', colError.message);
    } else {
        console.log('container_type_id and container_size_id columns likely EXIST.');
    }
  }
}

inspect();
