const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testJoin() {
  console.log('Testing join query...');
  
  // First, get a quote ID if any exists
  const { data: quotes, error: listError } = await supabase
    .from('quotes')
    .select('id')
    .limit(1);

  if (listError) {
    console.error('List quotes failed:', listError);
    return;
  }

  if (!quotes || quotes.length === 0) {
    console.log('No quotes found. Cannot test join without data.');
    return;
  }

  const quoteId = quotes[0].id;
  console.log('Found quote ID:', quoteId);

  // Now try the join query
  const { data, error } = await supabase
    .from('quotes')
    .select('*, origin_port_data:origin_port_id(location_name, location_code), destination_port_data:destination_port_id(location_name, location_code)')
    .eq('id', quoteId)
    .maybeSingle();

  if (error) {
    console.error('Join query failed:', error);
  } else {
    console.log('Join query successful. Data:', JSON.stringify(data, null, 2));
    if (data.origin_port_data) {
      console.log('Origin Port Data found:', data.origin_port_data);
    } else {
      console.log('Origin Port Data is NULL');
    }
  }
}

testJoin();
