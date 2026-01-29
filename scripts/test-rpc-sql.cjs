
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRpc() {
  console.log(`Connecting to ${supabaseUrl}...`);
  
  // Test 1: Simple Select from public table
  try {
    const { data, error } = await supabase.from('tenants').select('count', { count: 'exact', head: true });
    if (error) {
      console.error('❌ Public table access failed:', error.message);
    } else {
      console.log('✅ Public table access successful. Tenants count:', data); // data is null for head: true, but count is in count property? No, head returns null data.
    }
  } catch (e) {
    console.error('❌ Public table access exception:', e.message);
  }

  // Test 2: Check for execute_sql_query RPC
  try {
    console.log('Testing execute_sql_query RPC...');
    const { data, error } = await supabase.rpc('execute_sql_query', { query_text: 'SELECT version()' });
    
    if (error) {
      console.error('❌ execute_sql_query failed:', error.message);
      console.error('Error details:', error);
    } else {
      console.log('✅ execute_sql_query successful!');
      console.log('Result:', data);
    }
  } catch (e) {
    console.error('❌ execute_sql_query exception:', e.message);
  }
}

testRpc();
