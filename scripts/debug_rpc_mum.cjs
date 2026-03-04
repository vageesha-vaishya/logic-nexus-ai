
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// Load environment variables
function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  const envLocalPath = path.resolve(__dirname, '../.env.local');
  
  let envVars = {};
  
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        let value = match[2].trim();
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        envVars[match[1].trim()] = value;
      }
    });
  }
  
  if (fs.existsSync(envLocalPath)) {
    const envConfig = fs.readFileSync(envLocalPath, 'utf8');
    envConfig.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        let value = match[2].trim();
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        envVars[match[1].trim()] = value;
      }
    });
  }
  
  return envVars;
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || (!supabaseKey && !supabaseServiceKey)) {
  console.error('Error: Supabase credentials missing');
  process.exit(1);
}

// Use service key to bypass RLS for this test script if available, 
// but we really want to test the RPC behavior which might be SECURITY INVOKER.
// However, as a script, we don't have a user session easily. 
// Using anon key might hit RLS issues if we don't sign in.
// Using service key bypasses RLS, so it tests the FUNCTION LOGIC, not permissions.
// We verified permissions earlier.
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseKey);

async function testSearch(searchText) {
  console.log(`\nTesting search for: "${searchText}"`);
  
  // 1. Test RPC
  console.log('--- RPC search_locations ---');
  const { data: rpcData, error: rpcError } = await supabase.rpc('search_locations', {
    search_text: searchText,
    limit_count: 10
  });
  
  if (rpcError) {
    console.error('RPC Error:', rpcError);
  } else {
    console.log(`RPC returned ${rpcData ? rpcData.length : 0} results`);
    if (rpcData && rpcData.length > 0) {
      rpcData.forEach(item => {
        console.log(`- ${item.location_name || item.name} (${item.location_code || item.code}) [${item.city || item.city_name}]`);
      });
    }
  }
  
  // 2. Test Fallback Logic (mimicking LocationAutocomplete.tsx)
  console.log('\n--- Fallback Query Logic ---');
  // Mimic: .or(`location_name.ilike.%${debouncedSearch}%,location_code.ilike.%${debouncedSearch}%,city.ilike.%${debouncedSearch}%`)
  const { data: fallbackData, error: fallbackError } = await supabase
    .from('ports_locations')
    .select('id, location_name, location_code, location_type, country, city')
    .or(`location_name.ilike.%${searchText}%,location_code.ilike.%${searchText}%,city.ilike.%${searchText}%`)
    .limit(10);
    
  if (fallbackError) {
    console.error('Fallback Error:', fallbackError);
  } else {
    console.log(`Fallback returned ${fallbackData ? fallbackData.length : 0} results`);
    if (fallbackData && fallbackData.length > 0) {
      fallbackData.forEach(item => {
        console.log(`- ${item.location_name} (${item.location_code}) [${item.city}]`);
      });
    }
  }
}

async function run() {
  await testSearch('mum');
  await testSearch('Dehra Dun');
}

run();
