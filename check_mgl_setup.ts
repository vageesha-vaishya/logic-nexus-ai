
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSetup() {
  console.log('Checking Tenant...');
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, name')
    .ilike('name', '%Main Template%')
    .single();

  if (tenantError) {
    console.error('Error fetching tenant:', tenantError);
    return;
  }
  console.log('Tenant found:', tenant);

  console.log('\nChecking Templates for Tenant...');
  const { data: templates, error: templatesError } = await supabase
    .from('quote_templates')
    .select('id, name, tenant_id, is_active')
    .eq('tenant_id', tenant.id);

  if (templatesError) {
    console.error('Error fetching templates:', templatesError);
    return;
  }
  console.log('Templates found:', templates);

  const mainTemplate = templates.find(t => t.name === 'Main-Template');
  if (mainTemplate) {
    console.log('\nMain-Template is present and active:', mainTemplate.is_active);
  } else {
    console.error('\nMain-Template is MISSING for this tenant!');
  }
}

checkSetup();
