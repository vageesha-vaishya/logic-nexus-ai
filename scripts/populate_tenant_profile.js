
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('Starting Tenant Profile population...');

  // 1. Get all tenants
  const { data: tenants, error: tenantsError } = await supabase
    .from('tenants')
    .select('id, name');

  if (tenantsError) {
    console.error('Error fetching tenants:', tenantsError);
    return;
  }

  console.log(`Found ${tenants.length} tenants.`);

  for (const tenant of tenants) {
    // 2. Check if profile exists
    const { data: profile, error: profileError } = await supabase
      .from('tenant_profile')
      .select('tenant_id, registered_address')
      .eq('tenant_id', tenant.id)
      .maybeSingle();

    if (profileError) {
      console.error(`Error checking profile for tenant ${tenant.name} (${tenant.id}):`, profileError);
      continue;
    }

    const dummyAddress = '123 Logistics Way, Suite 100, Miami, FL 33132';
    const dummyTaxId = 'US-123456789';

    if (!profile) {
      console.log(`Creating profile for tenant: ${tenant.name}`);
      const { error: insertError } = await supabase
        .from('tenant_profile')
        .insert({
          tenant_id: tenant.id,
          legal_name: tenant.name,
          registered_address: dummyAddress,
          tax_id: dummyTaxId
        });

      if (insertError) {
        console.error(`Failed to create profile for ${tenant.name}:`, insertError);
      } else {
        console.log(`Successfully created profile for ${tenant.name}`);
      }
    } else {
      // Update if address is missing
      if (!profile.registered_address) {
          console.log(`Updating profile for tenant: ${tenant.name}`);
          const { error: updateError } = await supabase
            .from('tenant_profile')
            .update({
              registered_address: dummyAddress,
              tax_id: dummyTaxId
            })
            .eq('tenant_id', tenant.id);
            
          if (updateError) {
             console.error(`Failed to update profile for ${tenant.name}:`, updateError);
          } else {
             console.log(`Successfully updated profile for ${tenant.name}`);
          }
      } else {
          console.log(`Profile already complete for tenant: ${tenant.name}`);
      }
    }
  }
  
  console.log('Done.');
}

main();
