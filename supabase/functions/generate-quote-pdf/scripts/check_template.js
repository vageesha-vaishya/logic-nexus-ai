
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function checkTemplates() {
  console.log('Checking MGL Templates...');

  const templateNames = [
    'MGL Standard Granular',
    'MGL FCL Quote',
    'MGL Granular Quote'
  ];

  const { data: templates, error } = await supabase
    .from('quote_templates')
    .select('id, name, content, tenant_id')
    .in('name', templateNames);

  if (error) {
    console.error('Error fetching templates:', error);
    return;
  }

  console.log(`Found ${templates.length} templates.`);

  templates.forEach(t => {
    console.log(`\nTemplate: ${t.name} (ID: ${t.id}, Tenant: ${t.tenant_id})`);
    const config = t.content?.config;
    console.log('Config:', config);
    if (!config) {
        console.error('❌ Config object is MISSING!');
    } else if (!config.default_locale) {
        console.error('❌ default_locale is MISSING!');
    } else {
        console.log('✅ Config is valid.');
    }
  });
}

checkTemplates();
