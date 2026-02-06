
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env vars
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  console.log('Checking container_types...');
  const { data: types, error: typesError } = await supabase
    .from('container_types')
    .select('*');
  if (typesError) console.error(typesError);
  else types.forEach(t => console.log(`Type: ${t.name}, ID: ${t.id}`));

  console.log('\nChecking container_sizes...');
  const { data: sizes, error: sizesError } = await supabase
    .from('container_sizes')
    .select('*');
  
  if (sizesError) {
    console.error('Error fetching container_sizes:', sizesError);
  } else {
    console.log(`Found ${sizes.length} container sizes.`);
    sizes.forEach(s => console.log(`- ID: ${s.id}, Name: "${s.name}", TypeID: ${s.type_id}`));
  }
}

checkData();
