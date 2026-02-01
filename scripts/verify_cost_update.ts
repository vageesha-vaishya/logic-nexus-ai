
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Starting Cost Structure Update Verification...');

  // 1. Setup Test Data (Vendor, Service, Link)
  const vendorCode = `TEST-V-${Date.now()}`;
  const { data: vendor, error: vendorError } = await supabase
    .from('vendors')
    .insert({ name: 'Cost Test Vendor', code: vendorCode, type: 'carrier' })
    .select().single();
  if (vendorError) throw vendorError;

  const serviceCode = `TEST-S-${Date.now()}`;
  const { data: service, error: serviceError } = await supabase
    .from('services')
    .insert({ service_name: 'Cost Test Service', service_code: serviceCode, service_type: 'ocean', is_active: true })
    .select().single();
  if (serviceError) throw serviceError;

  const { data: link, error: linkError } = await supabase
    .from('service_vendors')
    .insert({
      service_id: service.id,
      vendor_id: vendor.id,
      cost_structure: { rate: 50, currency: 'USD' }
    })
    .select().single();
  if (linkError) throw linkError;

  console.log(`Initial Link Created. Cost:`, link.cost_structure);

  // 2. Simulate Update (as if from UI)
  console.log('Updating cost structure...');
  const newCost = { rate: 125.50, currency: 'EUR', unit: 'per container' };
  
  const { data: updatedLink, error: updateError } = await supabase
    .from('service_vendors')
    .update({ cost_structure: newCost })
    .eq('id', link.id)
    .select().single();

  if (updateError) throw updateError;

  // 3. Verify Update
  console.log(`Updated Cost:`, updatedLink.cost_structure);

  if (
    updatedLink.cost_structure.rate === 125.50 &&
    updatedLink.cost_structure.currency === 'EUR' &&
    updatedLink.cost_structure.unit === 'per container'
  ) {
    console.log('✅ Verification SUCCESS: Cost structure updated correctly.');
  } else {
    console.error('❌ Verification FAILED: Data mismatch.');
  }

  // 4. Cleanup
  await supabase.from('service_vendors').delete().eq('id', link.id);
  await supabase.from('vendors').delete().eq('id', vendor.id);
  await supabase.from('services').delete().eq('id', service.id);
  console.log('Cleanup complete.');
}

main().catch(console.error);
