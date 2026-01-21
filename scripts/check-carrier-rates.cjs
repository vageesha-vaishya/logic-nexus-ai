const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  const envMigrationPath = path.resolve(__dirname, '../.env.migration');
  
  const paths = [envPath, envMigrationPath];
  const env = {};

  paths.forEach(p => {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf-8');
      content.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim().replace(/^['"]|['"]$/g, '');
          env[key] = value;
        }
      });
    }
  });
  return env;
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCarrierRates() {
  try {
    console.log('1. Testing SELECT 1...');
    const test = await supabase.rpc('execute_sql_query', {
      query_text: "SELECT 1"
    });
    console.log('Result:', test.error ? test.error : test.data);

    console.log('2. Testing SELECT count(*) FROM carrier_rates...');
    const count = await supabase.rpc('execute_sql_query', {
      query_text: "SELECT count(*) FROM carrier_rates"
    });
    console.log('Result:', count.error ? count.error : count.data);

    console.log('3. Checking carrier_rates columns...');
    const columns = await supabase.rpc('execute_sql_query', {
      query_text: "SELECT column_name FROM information_schema.columns WHERE table_name = 'carrier_rates'"
    });
    
    if (columns.error) {
      console.error('Error:', columns.error);
    } else {
      console.log('Carrier Rates Columns:', columns.data);
    }

    console.log('4. Checking quotes columns...');
    const qColumns = await supabase.rpc('execute_sql_query', {
      query_text: "SELECT column_name FROM information_schema.columns WHERE table_name = 'quotes'"
    });

    if (qColumns.error) {
      console.error('Error:', qColumns.error);
    } else {
      console.log('Quotes Columns:', qColumns.data);
    }

  } catch (err) {
    console.error('Script Error:', err);
  }
}

checkCarrierRates();
