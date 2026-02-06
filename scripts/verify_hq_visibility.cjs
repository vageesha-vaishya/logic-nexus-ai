const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function runTest() {
  console.log('Starting HQ Visibility Verification...');

  // 1. Setup Data
  const uniqueId = Date.now();
  const emailDomain = `test${uniqueId}.com`;
  const tenantName = `Tenant ${uniqueId}`;
  
  // Create Platform Domain
  const { data: domain, error: domainErr } = await supabaseAdmin
    .from('platform_domains')
    .insert({ 
        key: `test-${uniqueId}`,
        code: `test-${uniqueId}`,
        name: tenantName,
        status: 'active'
    })
    .select()
    .single();
    
  if (domainErr) throw new Error(`Domain creation failed: ${domainErr.message}`);

  // Create Tenant
  const { data: tenant, error: tenantErr } = await supabaseAdmin
    .from('tenants')
    .insert({ 
      name: tenantName, 
      domain_id: domain.id,
      slug: `tenant-${uniqueId}` // Generate unique slug
    })
    .select()
    .single();

  if (tenantErr) throw new Error(`Tenant creation failed: ${tenantErr.message}`);

  // Create HQ User (Standard User, No Franchise)
  const hqUserEmail = `hq-user@${emailDomain}`;
  const { data: hqUserAuth, error: hqAuthErr } = await supabaseAdmin.auth.admin.createUser({
    email: hqUserEmail,
    password: 'Password123!',
    email_confirm: true
  });
  if (hqAuthErr) throw new Error(`HQ User creation failed: ${hqAuthErr.message}`);

  // Assign Role (User)
  await supabaseAdmin.from('user_roles').insert({
    user_id: hqUserAuth.user.id,
    tenant_id: tenant.id,
    role: 'user',
    franchise_id: null // Explicitly NULL
  });

  // Create HQ Account (franchise_id is NULL)
  const { data: hqAccount, error: accErr } = await supabaseAdmin.from('accounts').insert({
    tenant_id: tenant.id,
    franchise_id: null,
    name: 'HQ Shared Account',
    account_type: 'customer'
  }).select().single();
  
  if (accErr) throw new Error(`HQ Account creation failed: ${accErr.message}`);

  // 2. Test Visibility
  console.log('Testing visibility for HQ User...');
  
  const hqClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Sign in as HQ User (simulated by using service key but RLS won't apply unless we use correct client or impersonate)
  // Actually, standard way is to sign in.
  const { data: sessionData, error: loginErr } = await hqClient.auth.signInWithPassword({
    email: hqUserEmail,
    password: 'Password123!'
  });
  
  if (loginErr) throw new Error(`Login failed: ${loginErr.message}`);

  // Now query accounts
  const { data: visibleAccounts, error: queryErr } = await hqClient
    .from('accounts')
    .select('*')
    .eq('id', hqAccount.id);

  if (queryErr) {
    console.error('Error querying accounts:', queryErr);
  } else {
    console.log(`Visible Accounts: ${visibleAccounts.length}`);
    if (visibleAccounts.length === 1) {
      console.log('✅ SUCCESS: HQ User can see HQ Account.');
    } else {
      console.error('❌ FAILURE: HQ User CANNOT see HQ Account (Gap Detected).');
    }
  }

  // Cleanup
  console.log('Cleaning up...');
  await supabaseAdmin.from('tenants').delete().eq('id', tenant.id);
  await supabaseAdmin.auth.admin.deleteUser(hqUserAuth.user.id);
  await supabaseAdmin.from('platform_domains').delete().eq('id', domain.id);
}

runTest().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
