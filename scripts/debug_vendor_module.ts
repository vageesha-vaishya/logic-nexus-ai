
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
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

async function debugVendorModule() {
  console.log('Starting Vendor Module Debugging...');
  console.log('-----------------------------------');

  // 1. Verify Vendors Table Exists and Count
  console.log('\n1. Checking "vendors" table...');
  const { count: vendorCount, error: countError } = await supabase
    .from('vendors')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ Error accessing vendors table:', countError.message);
  } else {
    console.log(`✅ Vendors table accessible. Total count: ${vendorCount}`);
  }

  // 2. Fetch Sample Vendors (Admin Access)
  console.log('\n2. Fetching sample vendors (limit 5)...');
  const { data: vendors, error: fetchError } = await supabase
    .from('vendors')
    .select('*')
    .limit(5);

  if (fetchError) {
    console.error('❌ Error fetching vendors:', fetchError.message);
  } else if (vendors.length === 0) {
    console.warn('⚠️ No vendors found in the database.');
  } else {
    console.log(`✅ Fetched ${vendors.length} vendors.`);
    vendors.forEach(v => {
      console.log(`   - [${v.type}] ${v.name} (ID: ${v.id}, Status: ${v.status}, Tenant: ${v.tenant_id || 'Global'})`);
    });
  }

  // 3. Check Related Tables
  const relatedTables = [
    'vendor_contracts',
    'vendor_documents',
    'vendor_performance_reviews',
    'vendor_risk_assessments',
    'service_vendors'
  ];

  console.log('\n3. Checking related tables...');
  for (const table of relatedTables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.error(`❌ Error accessing ${table}:`, error.message);
    } else {
      console.log(`✅ ${table}: ${count} records`);
    }
  }

  // 4. Check RLS Policies (via pg_policies if accessible, or inference)
  // Note: Service role bypasses RLS, so we can't test RLS enforcement here directly without a user token.
  // But we can check if the system tables indicate policies exist.
  // Note: 'pg_policies' is not directly accessible via PostgREST usually, unless exposed.
  // We'll skip direct policy querying and rely on the fact that we can access data via Service Role.

  // 5. Check User Roles (to ensure admins exist)
  console.log('\n4. Checking User Roles (Platform Admins)...');
  const { data: admins, error: adminError } = await supabase
    .from('user_roles')
    .select('user_id, role, tenant_id')
    .eq('role', 'platform_admin');

  if (adminError) {
    console.error('❌ Error accessing user_roles:', adminError.message);
  } else {
    console.log(`✅ Found ${admins.length} platform_admin(s).`);
  }
  
  console.log('\n-----------------------------------');
  console.log('Debugging Complete.');
}

debugVendorModule().catch(err => {
  console.error('Unexpected Error:', err);
  process.exit(1);
});
