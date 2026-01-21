
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
  console.log('Checking schema for account_id vs customer_id...');

  const tables = ['quotes', 'carrier_rates'];
  let allGood = true;

  for (const table of tables) {
    console.log(`\nChecking table: ${table}`);
    
    // Check for account_id
    const { data: accountIdCol, error: accountIdError } = await supabase
      .rpc('get_column_info', { table_name: table, column_name: 'account_id' })
      .maybeSingle();

    // Since we might not have get_column_info RPC, let's try to select from information_schema via a raw query substitute?
    // We can't run raw SQL easily without an RPC. 
    // Instead, we can try to select a single row and see the keys returned, OR use a known hack if available.
    // Or just trust the previous migrations. 
    // Actually, we can just try to SELECT the column.
    
    const { data: dataAccount, error: errorAccount } = await supabase
      .from(table)
      .select('account_id')
      .limit(1);

    if (errorAccount) {
      console.error(`❌ 'account_id' column check failed in ${table}:`, errorAccount.message);
      allGood = false;
    } else {
      console.log(`✅ 'account_id' column exists in ${table}`);
    }

    const { data: dataCustomer, error: errorCustomer } = await supabase
      .from(table)
      .select('customer_id')
      .limit(1);

    if (!errorCustomer) {
      console.warn(`⚠️ 'customer_id' column still exists in ${table} (Legacy?)`);
    } else {
      console.log(`✅ 'customer_id' column does not exist in ${table} (Correct)`);
    }
  }

  if (allGood) {
    console.log('\n✅ Schema verification passed: account_id is present.');
  } else {
    console.error('\n❌ Schema verification failed.');
    process.exit(1);
  }
}

checkSchema();
