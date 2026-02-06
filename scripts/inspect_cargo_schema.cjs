const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSchema() {
  const { data, error } = await supabase
    .from('cargo_details')
    .select('*')
    .limit(1);

  if (error) {
    console.error(error);
  } else if (data && data.length > 0) {
    console.log('Columns:', Object.keys(data[0]));
  } else {
    console.log('No data found, cannot inspect columns from data.');
  }
}

inspectSchema();
