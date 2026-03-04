const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables
const envLocalPath = path.resolve(__dirname, '../.env.local');
const envPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env or .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
  console.log('Checking quotes table schema...');
  
  // Method 1: RPC call to get columns (if we had a generic SQL exec RPC, but we probably don't)
  // Method 2: Use PostgREST to inspect the table structure if exposed, or just try to select * limit 0
  
  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error selecting from quotes:', error);
  } else {
    console.log('Successfully selected from quotes. Keys available in result:');
    if (data && data.length > 0) {
      console.log(Object.keys(data[0]).sort().join('\n'));
    } else {
      console.log('Table is empty, cannot infer columns from data.');
      // Fallback: try to insert a dummy record and fail, to see error? No, that's risky.
    }
  }

  console.log('\n--- Checking specific columns existence ---');
  // Check specifically for origin, destination, origin_port_id, destination_port_id
  const { data: colData, error: colError } = await supabase
    .from('quotes')
    .select('origin, destination, origin_port_id, destination_port_id')
    .limit(1);
    
  if (colError) {
    console.error('Error selecting specific columns:', colError.message);
  } else {
    console.log('Specific columns exist.');
  }
}

checkSchema();
