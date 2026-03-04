const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load .env explicitly
const envPath = path.resolve(__dirname, '../.env');
console.log('Loading env from:', envPath);
dotenv.config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Supabase URL:', supabaseUrl ? 'Found' : 'Missing');
console.log('Service Key:', supabaseServiceKey ? 'Found' : 'Missing');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkLatestQuotes() {
  console.log('Checking latest quotes for origin/destination IDs...');
  
  const { data, error } = await supabase
    .from('quotes')
    .select('id, quote_number, origin_location, destination_location, origin_port_id, destination_port_id, origin_code, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (error) {
    console.error('Error fetching quotes:', error);
    return;
  }
  
  console.log('Latest 10 quotes:');
  data.forEach(q => {
    console.log(`Quote ${q.quote_number || q.id.substring(0,8)}:`);
    console.log(`  Origin JSON: ${JSON.stringify(q.origin_location)}`);
    console.log(`  Dest JSON:   ${JSON.stringify(q.destination_location)}`);
    console.log(`  Origin ID:   ${q.origin_port_id}`);
    console.log(`  Dest ID:     ${q.destination_port_id}`);
    console.log(`  Origin Code: ${q.origin_code}`);
    console.log('---');
  });
}

checkLatestQuotes();
