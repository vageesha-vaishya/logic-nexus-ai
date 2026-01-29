const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not found in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyFinanceSchema() {
  console.log(`Testing connection to ${supabaseUrl}...`);
  
  try {
    // Try to select from a table in the finance schema
    const { data, error } = await supabase
      .schema('finance')
      .from('tax_jurisdictions')
      .select('count', { count: 'exact', head: true });

    if (error) {
      console.error('Error querying finance schema:', error);
      if (error.code === 'PGRST106') {
        console.error('CRITICAL: Schema "finance" is not exposed in PostgREST configuration.');
        console.error('Action required: Add "finance" to "exposed_schemas" in Supabase Dashboard > API Settings.');
      }
      process.exit(1);
    }

    console.log('Success! Finance schema is accessible.');
    console.log('Response:', data);
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

verifyFinanceSchema();
