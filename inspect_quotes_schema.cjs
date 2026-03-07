const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const client = createClient(supabaseUrl, supabaseServiceKey);

async function inspectSchema() {
  const { data: quotes, error } = await client
    .from('quotes')
    .select('id, quote_number, valid_until')
    .limit(1);

  if (error) {
    console.error('Error:', error);
  } else if (quotes.length > 0) {
    console.log('First Quote:', quotes[0]);
  } else {
    console.log('No quotes found.');
  }
}

inspectSchema();
