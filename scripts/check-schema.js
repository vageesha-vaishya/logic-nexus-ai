
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('Checking carrier_rates columns...');
  
  // Try to select one row with customer_id
  const { data: data1, error: error1 } = await supabase
    .from('carrier_rates')
    .select('customer_id')
    .limit(1);

  if (error1) {
    console.log('❌ select(customer_id) failed:', error1.message);
  } else {
    console.log('✅ select(customer_id) succeeded');
  }

  // Try to select one row with account_id
  const { data: data2, error: error2 } = await supabase
    .from('carrier_rates')
    .select('account_id')
    .limit(1);

  if (error2) {
    console.log('❌ select(account_id) failed:', error2.message);
  } else {
    console.log('✅ select(account_id) succeeded');
  }
}

checkSchema();
