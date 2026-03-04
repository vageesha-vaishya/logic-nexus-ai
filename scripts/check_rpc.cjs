
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRpc() {
  const { data, error } = await supabase.rpc('execute_sql_query', { sql_query: 'SELECT 1' });
  if (error) {
    console.error('RPC execute_sql_query check failed:', error);
  } else {
    console.log('RPC execute_sql_query works:', data);
  }
}

checkRpc();
