const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkColumns() {
  const { data, error } = await supabase
    .from('quotation_version_options')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error);
  } else if (data && data.length > 0) {
    console.log('Columns:', Object.keys(data[0]));
  } else {
    console.log('No data found, trying to inspect via error or just assuming based on successful select if no error');
    // We can try to select carrier_id specifically
    const { error: colError } = await supabase.from('quotation_version_options').select('carrier_id').limit(1);
    if (colError) {
      console.log('carrier_id column likely does not exist:', colError.message);
    } else {
      console.log('carrier_id column exists!');
    }
  }
}

checkColumns();
