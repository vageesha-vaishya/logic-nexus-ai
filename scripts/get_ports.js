
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function getPorts() {
  const { data, error } = await supabase.from('ports_locations').select('id, location_name, country_id').limit(5);
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}

getPorts();
