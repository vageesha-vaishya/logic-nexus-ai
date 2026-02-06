const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectTaric() {
  const { data, error } = await supabase
    .from('taric_codes')
    .select('*')
    .limit(1);

  if (error) {
    console.error(error);
  } else {
    console.log(data);
  }
}

inspectTaric();
