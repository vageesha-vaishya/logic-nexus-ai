// Script to verify permissions for quotation configuration
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyPermissions() {
  console.log('--- Verifying Permissions for Quotation Configuration ---');

  // 1. Check if table exists and has RLS enabled
  console.log('\n1. Checking Table Status...');
  const { data: tableInfo, error: tableError } = await supabase
    .rpc('get_table_info', { table_name: 'quotation_configuration' }); // Assuming this RPC exists or we can infer from error

  // Since we don't have a handy RPC for table info in standard setup, we'll try a direct insert test with a fake user token if possible,
  // or just check if we can select as service role (which should work).
  
  const { data: configs, error: configError } = await supabase
    .from('quotation_configuration')
    .select('*')
    .limit(1);

  if (configError) {
      console.error('FAIL: Service role cannot access table:', configError.message);
  } else {
      console.log('SUCCESS: Service role can access table.');
  }

  // 2. Check Policies (Manual Inspection via SQL query if possible, or inference)
  // We'll inspect the policies using pg_policies system view via rpc if allowed, or just trust the migration file content we saw.
  // The migration defined:
  // CREATE POLICY "Admins can manage quotation config" ON public.quotation_configuration FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'tenant_admin'));
  
  // Issue: The previous migration used `get_user_tenant_id` and `has_role`. 
  // If the user trying to update is NOT a 'tenant_admin', they will fail.
  // We need to verify if the current user in the UI has 'tenant_admin' role.

  console.log('\n2. Policy Analysis:');
  console.log('   - SELECT: Allowed for all users in tenant (get_user_tenant_id)');
  console.log('   - UPDATE: Allowed ONLY for "tenant_admin" role');

  console.log('\n3. Diagnosis Suggestion:');
  console.log('   If the user in the UI is getting "Failed to update setting", they likely lack the "tenant_admin" role.');
  console.log('   OR the `get_user_tenant_id` function is returning null/mismatch.');
}

verifyPermissions();
