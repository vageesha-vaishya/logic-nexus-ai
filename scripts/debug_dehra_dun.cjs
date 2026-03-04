const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
const envPathLocal = path.resolve(__dirname, '../.env.local');
const envPathMain = path.resolve(__dirname, '../.env');

let envLoaded = false;
if (fs.existsSync(envPathLocal)) {
    console.log('Loading .env.local');
    const envConfig = dotenv.parse(fs.readFileSync(envPathLocal));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
    envLoaded = true;
}

if (!envLoaded && fs.existsSync(envPathMain)) {
    console.log('Loading .env');
    const envConfig = dotenv.parse(fs.readFileSync(envPathMain));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
    envLoaded = true;
}

if (!envLoaded) {
    // Try dotenv.config as fallback
    dotenv.config({ path: envPathMain });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Supabase URL found:', !!supabaseUrl);
console.log('Supabase Key found:', !!supabaseKey);

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Supabase URL or Key is missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDehraDun() {
  console.log('Searching for "Dehra Dun"...');
  
  // 1. Search using RPC
  const { data: rpcData, error: rpcError } = await supabase.rpc('search_locations', {
    search_text: 'Dehra Dun',
    limit_count: 5
  });

  if (rpcError) {
    console.error('RPC Error:', rpcError);
  } else {
    console.log('RPC Result:', JSON.stringify(rpcData, null, 2));
  }

  // 2. Search using simple select (fallback logic)
  const { data: fallbackData, error: fallbackError } = await supabase
    .from('ports_locations')
    .select('id, location_name, location_code, location_type, country, city')
    .ilike('location_name', '%Dehra Dun%')
    .limit(5);

  if (fallbackError) {
    console.error('Fallback Error:', fallbackError);
  } else {
    console.log('Fallback Result:', JSON.stringify(fallbackData, null, 2));
  }
}

checkDehraDun();
