
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fetchTemplate() {
  const { data, error } = await supabase
    .from('quote_templates')
    .select('*')
    .eq('name', 'Standard Multi-Modal');

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Found templates:', data.length);
    data.forEach(t => {
        console.log(`--- Template ID: ${t.id} (Tenant: ${t.tenant_id}) ---`);
        console.log(JSON.stringify(t.content, null, 2));
    });
  } else {
    console.log('No "Standard Multi-Modal" template found.');
  }
}

fetchTemplate();
