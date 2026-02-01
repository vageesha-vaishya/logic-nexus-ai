import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyLogisticsSeeding() {
  console.log('🔍 Starting Logistics Seeding Verification...\n');

  // 1. Verify Domain
  const { data: domains, error: domainError } = await supabase
    .from('platform_domains')
    .select('*')
    .eq('key', 'logistics');
  
  if (domainError) throw domainError;
  if (domains.length === 0) throw new Error('❌ Domain logistics not found!');
  console.log(`✅ Domain "Logistics & Supply Chain" exists (ID: ${domains[0].id}).`);
  const logisticsId = domains[0].id;

  // 2. Verify Categories
  const expectedCategories = [
    'transport_mgmt', 
    'warehousing', 
    'last_mile', 
    'customs_compliance', 
    'supply_chain_vis'
  ];
  
  const { data: categories, error: catError } = await supabase
    .from('service_categories')
    .select('code, name, domain_id')
    .in('code', expectedCategories);

  if (catError) throw catError;
  
  const foundCodes = categories.map(c => c.code);
  const missingCodes = expectedCategories.filter(c => !foundCodes.includes(c));
  
  if (missingCodes.length > 0) {
    console.error(`❌ Missing Categories: ${missingCodes.join(', ')}`);
  } else {
    console.log(`✅ All ${expectedCategories.length} Logistics Categories found.`);
  }

  // Verify domain linkage
  // Note: If domain_id is null in DB, this check helps identify it
  const invalidDomainCats = categories.filter(c => c.domain_id !== logisticsId);
  if (invalidDomainCats.length > 0) {
     console.warn(`⚠️ Warning: Categories not linked to LOGISTICS domain: ${invalidDomainCats.map(c => c.code).join(', ')}`);
     console.log('   (They might be unlinked or linked to a different domain)');
  } else {
     console.log('✅ All verified categories correctly linked to LOGISTICS domain.');
  }

  // 3. Verify Service Types
  const expectedTypes = [
    'ocean_fcl', 
    'ocean_lcl',
    'air_express', 
    'road_ftl',
    'bonded_warehouse', 
    'cold_storage',
    'same_day_delivery', 
    'import_filing', 
    'real_time_tracking'
  ];

  const { data: types, error: typesError } = await supabase
    .from('service_types')
    .select('code, name, category_id, mode_id')
    .in('code', expectedTypes);

  if (typesError) throw typesError;

  const foundTypes = types.map(t => t.code);
  const missingTypes = expectedTypes.filter(t => !foundTypes.includes(t));

  if (missingTypes.length > 0) {
    console.error(`❌ Missing Service Types: ${missingTypes.join(', ')}`);
  } else {
    console.log(`✅ Found ${foundTypes.length}/${expectedTypes.length} Sample Service Types.`);
  }

  // 4. Verify Services (Check for Demo Services)
  const { data: services, error: servicesError } = await supabase
    .from('services')
    .select('service_code, service_name, tenant_id')
    .in('service_code', ['OC-FCL-STD-20', 'AIR-EXP-PRI', 'WH-COLD-EUR']);

  if (servicesError) throw servicesError;

  if (services.length > 0) {
    console.log(`✅ Found ${services.length} Demo Services:`);
    services.forEach(s => console.log(`   - ${s.service_code}: ${s.service_name}`));
  } else {
    console.warn('⚠️ No Demo Services found (Check if Tenant exists or Seeding ran).');
  }

  console.log('\n✨ Logistics Verification Complete.');
}

verifyLogisticsSeeding().catch(err => {
  console.error('Verification Failed:', err);
  process.exit(1);
});
