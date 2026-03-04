
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
  console.log('Testing query syntax...');
  
  // Try to find a quote first to use its ID
  const { data: quotes, error: qError } = await supabase
    .from('quotes')
    .select('id')
    .not('origin_port_id', 'is', null)
    .limit(1);

  if (qError) {
    console.error('Error fetching quotes:', qError);
    return;
  }

  if (!quotes || quotes.length === 0) {
    console.log('No quotes found to test with.');
    return;
  }

  const quoteId = quotes[0].id;
  console.log(`Testing with quote ID: ${quoteId}`);

  // Test the suspicious query syntax
  const { data, error } = await supabase
    .from('quotes')
    .select('*, origin_location:origin_port_id(location_name, location_code), destination_location:destination_port_id(location_name, location_code)')
    .eq('id', quoteId)
    .maybeSingle();

  if (error) {
    console.error('Query failed:', error);
    
    // Try the corrected syntax
    console.log('Trying corrected syntax...');
    const { data: data2, error: error2 } = await supabase
        .from('quotes')
        .select('*, origin_location:ports_locations!origin_port_id(location_name, location_code), destination_location:ports_locations!destination_port_id(location_name, location_code)')
        .eq('id', quoteId)
        .maybeSingle();
        
    if (error2) {
        console.error('Corrected query also failed:', error2);
    } else {
        console.log('Corrected query success:', data2 ? 'Data received' : 'No data');
        if (data2) {
            console.log('Origin:', data2.origin_location);
            console.log('Destination:', data2.destination_location);
        }
    }

  } else {
    console.log('Original query success:', data ? 'Data received' : 'No data');
    if (data) {
        console.log('Origin Port ID:', data.origin_port_id);
        console.log('Destination Port ID:', data.destination_port_id);
        console.log('Origin:', data.origin_location);
        console.log('Destination:', data.destination_location);
    }
  }
}

testQuery();
