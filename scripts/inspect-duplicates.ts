// Script to inspect quotation_configuration for duplicates
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function inspectDuplicates() {
  console.log('--- Inspecting quotation_configuration for duplicates ---');

  const { data, error } = await supabase
    .from('quotation_configuration')
    .select('id, tenant_id, default_module, smart_mode_enabled, created_at');

  if (error) {
    console.error('Error fetching data:', error);
    return;
  }

  console.log(`Found ${data.length} records.`);

  const tenantCounts: Record<string, number> = {};
  const duplicates: Record<string, any[]> = {};

  data.forEach((row) => {
    const tid = row.tenant_id;
    tenantCounts[tid] = (tenantCounts[tid] || 0) + 1;
    
    if (!duplicates[tid]) duplicates[tid] = [];
    duplicates[tid].push(row);
  });

  let foundDuplicates = false;
  Object.entries(tenantCounts).forEach(([tid, count]) => {
    if (count > 1) {
      foundDuplicates = true;
      console.log(`\n⚠️ Tenant ${tid} has ${count} records:`);
      duplicates[tid].forEach(d => console.log(`   - ID: ${d.id}, Module: ${d.default_module}, Smart: ${d.smart_mode_enabled}, Created: ${d.created_at}`));
    }
  });

  if (!foundDuplicates) {
    console.log('\n✅ No duplicates found. Unique constraint seems to be working.');
  } else {
      console.log('\n❌ Duplicates found! Need to cleanup.');
  }
}

inspectDuplicates();
