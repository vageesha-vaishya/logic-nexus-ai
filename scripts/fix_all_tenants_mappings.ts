
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixAllTenants() {
  console.log('Starting Fix for All Tenants Service Mappings...');

  // 1. Get All Tenants
  const { data: tenants, error: tError } = await supabase.from('tenants').select('id, name');
  if (tError) {
    console.error('Error fetching tenants:', tError);
    return;
  }

  console.log(`Found ${tenants.length} tenants.`);

  // 2. Get Reference Service Types (Global)
  const { data: serviceTypes, error: stError } = await supabase.from('service_types').select('*');
  if (stError) {
    console.error('Error fetching service types:', stError);
    return;
  }

  // Map service types by name/code for easy lookup
  // Assuming we want: 'Ocean Freight' (OCEAN), 'Air Freight' (AIR), 'Road Freight' (ROAD)
  const requiredServices = [
    { name: 'Ocean Freight', code: 'OCEAN', type: serviceTypes.find(t => t.code === 'OCEAN' || t.name.includes('Ocean')) },
    { name: 'Air Freight', code: 'AIR', type: serviceTypes.find(t => t.code === 'AIR' || t.name.includes('Air')) },
    { name: 'Road Freight', code: 'ROAD', type: serviceTypes.find(t => t.code === 'ROAD' || t.name.includes('Road')) },
  ];

  // 3. Iterate Tenants
  for (const tenant of tenants) {
    console.log(`\nProcessing Tenant: ${tenant.name} (${tenant.id})`);

    for (const svcDef of requiredServices) {
      if (!svcDef.type) {
        console.warn(`  Skipping ${svcDef.name} - Service Type not found in DB.`);
        continue;
      }

      // Check if Service exists for this tenant
      const { data: existingService, error: sError } = await supabase
        .from('services')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('service_type_id', svcDef.type.id)
        .maybeSingle();

      let serviceId = existingService?.id;

      if (!serviceId) {
        console.log(`  Creating Service: ${svcDef.name}...`);
        const { data: newSvc, error: createError } = await supabase
          .from('services')
          .insert({
            tenant_id: tenant.id,
            service_name: svcDef.name,
            service_code: svcDef.code,
            service_type: svcDef.code,
            service_type_id: svcDef.type.id,
            is_active: true,
            description: `Default ${svcDef.name} for ${tenant.name}`
          })
          .select('id')
          .single();

        if (createError) {
          console.error(`  Error creating service:`, createError);
          continue;
        }
        serviceId = newSvc.id;
      } else {
        console.log(`  Service ${svcDef.name} exists.`);
      }

      // Check Mapping
      const { data: existingMapping, error: mError } = await supabase
        .from('service_type_mappings')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('service_type_id', svcDef.type.id)
        .eq('service_id', serviceId)
        .maybeSingle();

      if (!existingMapping) {
        console.log(`  Creating Mapping for ${svcDef.name}...`);
        const { error: mapError } = await supabase
          .from('service_type_mappings')
          .insert({
            tenant_id: tenant.id,
            service_type_id: svcDef.type.id,
            service_id: serviceId,
            is_default: true
          });
        
        if (mapError) console.error(`  Error creating mapping:`, mapError);
        else console.log(`  Mapping created.`);
      } else {
        console.log(`  Mapping exists.`);
      }
    }
  }

  console.log('\nFix Complete.');
}

fixAllTenants().catch(console.error);
