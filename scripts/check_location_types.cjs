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

async function checkTypes() {
  console.log('Checking distinct location_type values...');
  
  const { data, error } = await supabase
    .from('ports_locations')
    .select('location_type')
    //.distinct(); // supabase js doesn't support distinct directly easily in select string without transform, let's just fetch some
    .limit(100);

  if (error) {
    console.error('Error:', error);
    return;
  }
  
  const types = new Set(data.map(d => d.location_type));
  console.log('Found types:', Array.from(types));
}

checkTypes();
