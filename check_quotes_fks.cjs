const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFKs() {
  const { data, error } = await supabase.rpc('get_foreign_keys_for_table', { table_name: 'quotes' });
  
  if (error) {
    // Fallback: try to query information_schema directly if RPC fails
    console.log('RPC failed, trying direct query (might fail if not allowed)...');
    // Note: client-side query to info schema is often blocked.
    // We'll rely on the error message or try a different approach if this fails.
    console.error('Error fetching FKs:', error);
  } else {
    console.log('Foreign Keys on quotes table:', data);
  }
}

// Since we can't easily call RPC if it doesn't exist, let's try to infer from a query
async function testJoin() {
  console.log('Testing join query...');
  const { data, error } = await supabase
    .from('quotes')
    .select('id, origin_port_id, origin_port_data:origin_port_id(location_name)')
    .limit(1);

  if (error) {
    console.error('Join query failed:', error);
  } else {
    console.log('Join query successful:', data);
  }
}

testJoin();
