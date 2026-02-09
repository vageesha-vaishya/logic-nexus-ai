const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function seedDomains() {
  console.log('🌱 Seeding Tenant Domains...');

  // 1. Get Tenants
  const { data: tenants, error: tError } = await supabase
    .from('tenants')
    .select('id, name, slug');
  
  if (tError) {
    console.error('Error fetching tenants:', tError);
    return;
  }

  if (!tenants || tenants.length === 0) {
    console.log('No tenants found.');
    return;
  }

  console.log(`Found ${tenants.length} tenants.`);

  // 2. Insert Domains for each tenant
  for (const t of tenants) {
    const domainName = `${t.slug}.com`; // simplified domain logic
    
    // Check if exists
    const { data: existing } = await supabase
      .from('tenant_domains')
      .select('id')
      .eq('tenant_id', t.id)
      .eq('domain_name', domainName)
      .single();

    if (!existing) {
      console.log(`Adding domain ${domainName} for tenant ${t.name}...`);
      const { error: insertError } = await supabase
        .from('tenant_domains')
        .insert({
          tenant_id: t.id,
          domain_name: domainName,
          is_verified: false,
          spf_verified: false,
          dkim_verified: false,
          dmarc_verified: false
        });
      
      if (insertError) console.error(`Error inserting domain for ${t.name}:`, insertError);
      else console.log(`✓ Added ${domainName}`);
    } else {
      console.log(`- Domain ${domainName} already exists for ${t.name}`);
    }
  }

  console.log('✅ Seeding complete.');
}

seedDomains();
