const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTaricTable() {
  // Check if table exists by selecting 1 row
  const { data, error } = await supabase
    .from('taric_codes')
    .select('*')
    .limit(1);

  if (error) {
    if (error.code === '42P01') { // undefined_table
      console.log('Table taric_codes DOES NOT exist.');
    } else {
      console.error('Error checking taric_codes:', error);
    }
  } else {
    console.log('Table taric_codes EXISTS.');
    // Check count
    const { count, error: countError } = await supabase
      .from('taric_codes')
      .select('*', { count: 'exact', head: true });
      
    if (!countError) {
      console.log(`Row count: ${count}`);
    }
  }
}

checkTaricTable();
