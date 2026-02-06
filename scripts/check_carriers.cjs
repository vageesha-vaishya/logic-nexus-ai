
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkCarriers() {
  const { data, error } = await supabase
    .from('carriers')
    .select('id, carrier_name, carrier_type, tenant_id')
    .limit(10);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Carriers:', data);
    console.log('Count:', data.length);
  }
  
  // Also check transport modes
  /*
  const { data: modes, error: modeError } = await supabase
    .from('transport_modes') // Adjust table name if needed, maybe it is an enum?
    .select('*')
    .limit(10);
    
   if (modeError) console.log('Error fetching modes (might be enum):', modeError.message);
   */
}

checkCarriers();
