
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRpc() {
  console.log('Testing search_locations RPC...');
  const { data, error } = await supabase.rpc('search_locations', {
    search_text: 'Dehra Dun',
    limit_count: 5
  });

  if (error) {
    console.error('RPC Error:', error);
  } else {
    console.log('RPC Data:', JSON.stringify(data, null, 2));
  }
  
  console.log('\nTesting Direct Query...');
  const { data: directData, error: directError } = await supabase
    .from('ports_locations')
    .select('id, location_name, location_code, location_type, country, city')
    .ilike('location_name', '%Dehra Dun%')
    .limit(5);
    
   if (directError) {
    console.error('Direct Query Error:', directError);
  } else {
    console.log('Direct Query Data:', JSON.stringify(directData, null, 2));
  }
}

testRpc();
