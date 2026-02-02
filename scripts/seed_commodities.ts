
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || (!supabaseKey && !serviceRoleKey)) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

// Use service role key for seeding to bypass RLS if needed, or anon if simulating user
const supabase = createClient(supabaseUrl, serviceRoleKey || supabaseKey!);

async function seed() {
  console.log('Seeding Master Commodities...');

  // 1. Get a tenant (just pick the first one)
  const { data: tenants } = await supabase.from('tenants').select('id').limit(1);
  if (!tenants || tenants.length === 0) {
    console.error('No tenants found. Cannot seed commodities.');
    return;
  }
  const tenantId = tenants[0].id;
  console.log(`Using tenant: ${tenantId}`);

  // 2. Get some HTS codes
  const { data: hts } = await supabase.from('aes_hts_codes').select('id, hts_code').limit(5);
  if (!hts || hts.length === 0) {
    console.error('No HTS codes found. Please seed HTS codes first.');
    return;
  }

  // 3. Get Cargo Types
  const { data: cargoTypes } = await supabase.from('cargo_types').select('id').limit(1);
  const cargoTypeId = cargoTypes?.[0]?.id;

  // 4. Create Commodities
  const commodities = [
    {
      tenant_id: tenantId,
      sku: 'IPHONE-15-PRO',
      name: 'iPhone 15 Pro Titanium',
      description: 'Apple iPhone 15 Pro 256GB Titanium Blue',
      aes_hts_id: hts[0].id,
      default_cargo_type_id: cargoTypeId,
      unit_value: 1099.00,
      currency: 'USD',
      origin_country: 'CN',
      hazmat_class: '9 (Battery)'
    },
    {
      tenant_id: tenantId,
      sku: 'NIKE-AIR-MAX',
      name: 'Nike Air Max 90',
      description: 'Mens Running Shoes Size 10',
      aes_hts_id: hts[1]?.id || hts[0].id,
      default_cargo_type_id: cargoTypeId,
      unit_value: 120.00,
      currency: 'USD',
      origin_country: 'VN'
    },
    {
      tenant_id: tenantId,
      sku: 'TESLA-MODEL-3-BATT',
      name: 'Tesla Model 3 Battery Pack',
      description: 'High Voltage Battery Pack for Model 3',
      aes_hts_id: hts[2]?.id || hts[0].id,
      default_cargo_type_id: cargoTypeId,
      unit_value: 15000.00,
      currency: 'USD',
      hazmat_class: '9',
      hazmat_un_number: 'UN3480'
    }
  ];

  const { error } = await supabase.from('master_commodities').upsert(commodities, { onConflict: 'tenant_id,sku' });

  if (error) {
    console.error('Error seeding commodities:', error);
  } else {
    console.log('Successfully seeded 3 master commodities.');
  }

  // 5. Test Search Function
  console.log('\nTesting HTS Search RPC...');
  const { data: searchResults, error: searchError } = await supabase.rpc('search_hts_codes', {
    search_term: 'parts',
    limit_count: 3
  });

  if (searchError) {
    console.error('Search RPC failed:', searchError);
  } else {
    console.log('Search RPC results:', searchResults);
  }
}

seed().catch(console.error);
