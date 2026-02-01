import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyEnterpriseArchitecture() {
  console.log('🏢 Starting Enterprise Architecture Verification...\n');

  // 1. Verify Global Service (Tenant ID is NULL)
  console.log('1️⃣  Checking Global Service Existence...');
  const { data: globalService, error: serviceError } = await supabase
    .from('services')
    .select('id, service_code, service_name, tenant_id, billing_config, pricing_config')
    .eq('service_code', 'GLOBAL-OC-FCL-20')
    .is('tenant_id', null)
    .single();

  if (serviceError) throw serviceError;
  if (!globalService) throw new Error('Global Service not found!');
  
  console.log(`   ✅ Found Global Service: ${globalService.service_name}`);
  console.log(`   ✅ Tenant ID is: ${globalService.tenant_id} (Expected: null)`);
  console.log(`   ✅ Billing Config: ${JSON.stringify(globalService.billing_config).substring(0, 60)}...`);

  // 2. Verify Pricing Tiers
  console.log('\n2️⃣  Checking Pricing Tiers...');
  const { data: tiers, error: tiersError } = await supabase
    .from('service_pricing_tiers')
    .select('*')
    .eq('service_id', globalService.id)
    .order('min_quantity');

  if (tiersError) throw tiersError;
  console.log(`   ✅ Found ${tiers.length} Pricing Tiers:`);
  tiers.forEach(t => {
    const max = t.max_quantity ? t.max_quantity : '∞';
    console.log(`      - Qty ${t.min_quantity} - ${max}: $${t.unit_price} (${t.currency})`);
  });

  // 3. Verify Vendor Linkage
  console.log('\n3️⃣  Checking Vendor Linkage...');
  const { data: vendors, error: vendorError } = await supabase
    .from('service_vendors')
    .select('*, vendors(name, type)')
    .eq('service_id', globalService.id);

  if (vendorError) throw vendorError;
  if (vendors.length === 0) throw new Error('No linked vendors found!');

  console.log(`   ✅ Found ${vendors.length} Linked Vendor(s):`);
  vendors.forEach(v => {
    // @ts-ignore
    console.log(`      - ${v.vendors.name} (${v.vendors.type}) | Preferred: ${v.is_preferred}`);
    console.log(`        Cost Structure: ${JSON.stringify(v.cost_structure)}`);
  });

  console.log('\n✨ Enterprise Architecture Verification Complete.');
}

verifyEnterpriseArchitecture().catch(console.error);
