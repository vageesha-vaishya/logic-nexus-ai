const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLocations() {
  console.log('Checking ports_locations table...');

  // 1. Check count
  const { count, error: countError } = await supabase
    .from('ports_locations')
    .select('*', { count: 'exact', head: true });
  
  if (countError) {
    console.error('Error counting locations:', countError);
  } else {
    console.log(`Total locations: ${count}`);
  }

  // 1.5 List first 10 locations to verify data
  const { data: first10, error: first10Error } = await supabase
    .from('ports_locations')
    .select('id, location_name, location_code')
    .limit(10);

  if (first10Error) {
    console.error('Error listing first 10 locations:', first10Error);
  } else {
    console.log('First 10 locations:', first10);
  }

  // 2. Search for 'mum' using ILIKE (simple text match)
  const { data: simpleData, error: simpleError } = await supabase
    .from('ports_locations')
    .select('id, location_name, location_code, location_type, country, city')
    .ilike('location_name', '%delhi%')
    .limit(5);

  if (simpleError) {
    console.error('Error searching locations (ILIKE):', simpleError);
  } else {
    console.log('Results for "mum" (ILIKE):', simpleData);
  }

  // 3. Search using the RPC
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('search_locations', { search_text: 'mum', limit_count: 5 });

  if (rpcError) {
    console.error('Error searching locations (RPC):', rpcError);
  } else {
    console.log('Results for "mum" (RPC):', rpcData);
  }
}

checkLocations();
