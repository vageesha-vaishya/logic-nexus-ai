
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Try loading .env.local first, then .env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
  console.log('Loading environment from .env.local');
  dotenv.config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  console.log('Loading environment from .env');
  dotenv.config({ path: envPath });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Supabase URL or Key is missing.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugRpc() {
  const searchTerm = 'Dehra Dun';
  console.log(`Calling search_locations RPC with '${searchTerm}'...`);

  const { data, error } = await supabase.rpc('search_locations', {
    search_text: searchTerm,
    limit_count: 5
  });

  if (error) {
    console.error('RPC Error:', error);
    return;
  }

  console.log('RPC returned data type:', typeof data);
  if (Array.isArray(data)) {
    console.log('Number of results:', data.length);
    if (data.length > 0) {
      console.log('First result structure:', Object.keys(data[0]));
      console.log('First result value:', JSON.stringify(data[0], null, 2));
    }
  } else {
    console.log('Data is not an array:', data);
  }
}

debugRpc();
