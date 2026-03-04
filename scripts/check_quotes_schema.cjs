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

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env or .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
  console.log('Checking schema for table "quotes"...');
  
  const { data, error } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type')
    .eq('table_schema', 'public')
    .eq('table_name', 'quotes')
    .order('column_name');

  if (error) {
    console.error('Error fetching schema:', error);
    // Try RPC as fallback if direct access to information_schema is blocked
    console.log('Trying RPC introspection...');
    return;
  }

  console.log('Columns in "quotes" table:');
  const columns = data.map(c => c.column_name);
  console.log(columns.join(', '));

  const hasOriginPort = columns.includes('origin_port_id');
  const hasDestPort = columns.includes('destination_port_id');
  const hasOriginText = columns.includes('origin');
  const hasDestText = columns.includes('destination');

  console.log('\nAnalysis:');
  console.log(`- origin_port_id: ${hasOriginPort ? 'EXISTS' : 'MISSING'}`);
  console.log(`- destination_port_id: ${hasDestPort ? 'EXISTS' : 'MISSING'}`);
  console.log(`- origin (text): ${hasOriginText ? 'EXISTS' : 'MISSING'}`);
  console.log(`- destination (text): ${hasDestText ? 'EXISTS' : 'MISSING'}`);
}

checkSchema();
