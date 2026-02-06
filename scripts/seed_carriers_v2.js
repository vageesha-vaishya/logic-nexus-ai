
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from project root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY; 

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('Warning: Using ANON KEY. This may fail due to RLS if you are not authenticated.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedCarriers() {
  console.log('Fetching tenants...');
  let { data: tenants, error: tenantsError } = await supabase.from('tenants').select('id');
  
  if (tenantsError) {
    console.error('Error fetching tenants:', tenantsError);
    return;
  }

  if (!tenants || tenants.length === 0) {
    console.log('No tenants found. Creating a default tenant...');
    const { data: newTenant, error: createError } = await supabase
      .from('tenants')
      .insert({
        name: 'Default Tenant',
        slug: 'default',
                is_active: true
              })
      .select('id')
      .single();
    
    if (createError) {
      console.error('Error creating tenant:', createError);
      return;
    }
    tenants = [newTenant];
    console.log('Created tenant:', newTenant.id);
  }

  console.log(`Found ${tenants.length} tenants. Seeding carriers...`);

  const carriersToSeed = [
    { name: 'Maersk', type: 'ocean', scac: 'MAEU' },
    { name: 'MSC', type: 'ocean', scac: 'MSCU' },
    { name: 'CMA CGM', type: 'ocean', scac: 'CMACGM' },
    { name: 'Lufthansa Cargo', type: 'air_cargo', iata: 'LH' },
    { name: 'Emirates SkyCargo', type: 'air_cargo', iata: 'EK' },
    { name: 'FedEx Express', type: 'air_cargo', iata: 'FX' },
    { name: 'J.B. Hunt', type: 'trucking', scac: 'JBHT' },
    { name: 'XPO Logistics', type: 'trucking', scac: 'XPO' },
    { name: 'DHL Express', type: 'courier', iata: 'DHL' },
    { name: 'FedEx Ground', type: 'courier', scac: 'FDXG' },
    { name: 'Union Pacific', type: 'rail', scac: null },
    { name: 'CSX', type: 'rail', scac: null }
  ];

  const modeMap = {
    'ocean': 'ocean',
    'air_cargo': 'air',
    'trucking': 'inland_trucking',
    'courier': 'courier',
    'rail': 'inland_trucking' // Fallback as rail is not in transport_mode enum
  };

  for (const tenant of tenants) {
    for (const carrier of carriersToSeed) {
      // Check if exists
      const { data: existing } = await supabase
        .from('carriers')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('carrier_name', carrier.name)
        .single();

      if (!existing) {
        const { error: insertError } = await supabase
          .from('carriers')
          .insert({
            tenant_id: tenant.id,
            carrier_name: carrier.name,
            carrier_type: carrier.type,
            mode: modeMap[carrier.type] || 'ocean', // Use mapped mode
            scac: carrier.scac,
            iata: carrier.iata,
            is_active: true
          });
        
        if (insertError) {
            console.error(`Error inserting ${carrier.name} for tenant ${tenant.id}:`, insertError);
        } else {
            console.log(`Inserted ${carrier.name} for tenant ${tenant.id}`);
        }
      }
    }
  }
  
  console.log('Seeding complete.');
}

seedCarriers();
