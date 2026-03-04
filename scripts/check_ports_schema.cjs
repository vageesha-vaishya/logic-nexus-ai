
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

async function checkSchema() {
  console.log('Checking ports_locations schema...');

  const { data, error } = await supabase
    .rpc('get_table_info', { table_name: 'ports_locations' });

  // If RPC fails (likely not there), fallback to querying via SQL if possible or just infer from a select * limit 1
  if (error) {
     console.log('RPC get_table_info failed, trying to select one row to see keys...');
     const { data: rowData, error: rowError } = await supabase
        .from('ports_locations')
        .select('*')
        .limit(1);
     
     if (rowError) {
        console.error('Error selecting row:', rowError);
     } else if (rowData && rowData.length > 0) {
        console.log('Columns found in first row:', Object.keys(rowData[0]));
        console.log('First row data:', rowData[0]);
     } else {
        console.log('Table is empty or no access.');
     }
  } else {
     console.log('Schema info:', data);
  }
}

checkSchema();
