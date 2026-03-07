const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env');
  process.exit(1);
}

const client = createClient(supabaseUrl, supabaseServiceKey);

async function findQuotes() {
  const { data: quotes, error } = await client
    .from('quotes')
    .select('id, quote_number, created_at, expiration_date')
    .limit(5);

  if (error) {
    console.error('Error fetching quotes:', error);
  } else {
    console.log(`Found ${quotes.length} quotes.`);
    quotes.forEach(q => {
      console.log(`- ${q.quote_number} (ID: ${q.id})`);
    });
  }
}

findQuotes();
