
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('Checking quotation_version_option_legs table schema...');
  const { data, error } = await supabase.from('quotation_version_option_legs').select('*').limit(1);

  console.log('Checking charge_bases table...');
  const { data: bases, error: basesError } = await supabase.from('charge_bases').select('*').limit(5);
  if (basesError) console.error('Error selecting charge_bases:', basesError);
  else console.log('Charge Bases:', bases);
  if (error) {
      console.error('Error selecting:', error);
  } else if (data && data.length > 0) {
      console.log('Columns in returned row:', Object.keys(data[0]));
  } else {
      console.log('Table is empty. Cannot determine columns from select.');
      // Insert invalid to force error listing columns
      const { error: insError } = await supabase.from('quote_items').insert({ 'invalid_col': 1 });
      if (insError) console.log('Insert error (might reveal columns):', insError.message, insError.hint);
  }
}

checkSchema();
