const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

// Service role client for setup/cleanup
const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runTest() {
  console.log('Starting Comprehensive Hierarchy Verification...');

  let tenantId, franchiseAId, franchiseBId;
  let userTenantAdmin, userFranchiseA, userFranchiseB, userHQ;
  let domainId;

  try {
    // -----------------------------------------------------------------------
    // 1. SETUP
    // -----------------------------------------------------------------------
    console.log('\n--- Setup Phase ---');

    // Get a valid domain_id
    const { data: domains, error: domainError } = await adminClient
      .from('platform_domains')
      .select('id')
      .limit(1);
    
    if (domainError) {
        console.warn('Could not fetch platform_domains:', domainError.message);
    }
    
    if (domains && domains.length > 0) {
        domainId = domains[0].id;
        console.log(`Using existing Domain ID: ${domainId}`);
    } else {
        // Create a dummy domain if none exist
        const { data: newDomain, error: createDomainError } = await adminClient
            .from('platform_domains')
            .insert({ name: 'Test Domain', key: `test-${Date.now()}`, code: `test-${Date.now()}`, status: 'active' })
            .select()
            .single();
        
        if (createDomainError) {
             console.warn('Failed to create platform_domain (might be ignored if optional):', createDomainError.message);
        } else {
            domainId = newDomain.id;
            console.log(`Created new Domain ID: ${domainId}`);
        }
    }

    // Create Tenant
    const uniqueId = Date.now();
    const tenantName = `TestTenant_${uniqueId}`;
    const tenantPayload = { 
        name: tenantName, 
        slug: `tenant-${uniqueId}`
    };
    if (domainId) {
        tenantPayload.domain_id = domainId;
    }

    const { data: tenant, error: tenantError } = await adminClient
      .from('tenants')
      .insert(tenantPayload)
      .select()
      .single();

    if (tenantError) throw new Error(`Failed to create tenant: ${tenantError.message}`);
    tenantId = tenant.id;
    console.log(`Created Tenant: ${tenantId}`);

    // Create Franchises
    const { data: franchises, error: franchiseError } = await adminClient
      .from('franchises')
      .insert([
        { tenant_id: tenantId, name: 'Franchise A', code: `FA_${uniqueId}` },
        { tenant_id: tenantId, name: 'Franchise B', code: `FB_${uniqueId}` }
      ])
      .select();

    if (franchiseError) throw new Error(`Failed to create franchises: ${franchiseError.message}`);
    franchiseAId = franchises[0].id;
    franchiseBId = franchises[1].id;
    console.log(`Created Franchises: A=${franchiseAId}, B=${franchiseBId}`);

    // Helper to create user and assign role
    const createUser = async (email, role, fId = null) => {
      const password = 'Password123!';
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name: 'Test', last_name: role }
      });

      if (authError) throw new Error(`Failed to create user ${email}: ${authError.message}`);
      const userId = authData.user.id;

      // Assign Role
      const { error: roleError } = await adminClient
        .from('user_roles')
        .insert({
          user_id: userId,
          role: role,
          tenant_id: tenantId,
          franchise_id: fId
        });
      
      if (roleError) throw new Error(`Failed to assign role to ${email}: ${roleError.message}`);

      // Sign in to get session/client
      const { data: signInData, error: signInError } = await createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY).auth.signInWithPassword({
        email,
        password
      });

      if (signInError) throw new Error(`Failed to sign in ${email}: ${signInError.message}`);
      
      return { 
        id: userId, 
        client: createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: `Bearer ${signInData.session.access_token}` } }
        })
      };
    };

    userTenantAdmin = await createUser(`ta_${uniqueId}@test.com`, 'tenant_admin');
    console.log('Created Tenant Admin');

    userFranchiseA = await createUser(`fa_${uniqueId}@test.com`, 'franchise_admin', franchiseAId);
    console.log('Created Franchise A Admin');

    userFranchiseB = await createUser(`fb_${uniqueId}@test.com`, 'franchise_admin', franchiseBId);
    console.log('Created Franchise B Admin');

    userHQ = await createUser(`hq_${uniqueId}@test.com`, 'user', null); // HQ User (No Franchise)
    console.log('Created HQ User (Standard)');


    // -----------------------------------------------------------------------
    // 2. EXECUTION & VERIFICATION
    // -----------------------------------------------------------------------
    console.log('\n--- Execution Phase ---');

    // =======================================================================
    // TEST 1: INVOICES (Franchise Isolation)
    // =======================================================================
    console.log('\n[TEST 1] Invoices Isolation');
    const invNumA = `INV-A-${uniqueId}`;
    const { data: invA, error: errA } = await userFranchiseA.client
      .from('invoices')
      .insert({
        tenant_id: tenantId,
        franchise_id: franchiseAId,
        invoice_number: invNumA,
        status: 'draft',
        issue_date: new Date().toISOString()
      })
      .select()
      .single();

    if (errA) console.error('❌ Failed to create Invoice A:', errA);
    else console.log('✅ Invoice A created');

    // Franchise B reads Invoice A
    const { data: readB, error: errReadB } = await userFranchiseB.client
      .from('invoices')
      .select('*')
      .eq('id', invA.id);
    
    if (readB && readB.length > 0) {
        console.error(`❌ VIOLATION: Franchise B can see Invoice A!`);
    } else {
        console.log('✅ SUCCESS: Franchise B cannot see Invoice A.');
    }

    // Tenant Admin reads Invoice A
    const { data: readT, error: errReadT } = await userTenantAdmin.client
      .from('invoices')
      .select('*')
      .eq('id', invA.id);

    if (readT && readT.length === 1) {
        console.log('✅ SUCCESS: Tenant Admin can see Invoice A.');
    } else {
        console.error(`❌ FAILURE: Tenant Admin cannot see Invoice A!`);
    }

    // =======================================================================
    // TEST 2: COMPLIANCE SCREENINGS (Auto-Population & Isolation)
    // =======================================================================
    console.log('\n[TEST 2] Compliance Screenings');
    // Create Screening as Franchise A Admin
    const { data: screenA, error: errScreenA } = await userFranchiseA.client
      .from('compliance_screenings')
      .insert({
        search_name: 'Test Entity A',
        search_country: 'US'
      })
      .select()
      .single();

    if (errScreenA) {
        console.error('❌ Failed to create Screening A:', errScreenA);
    } else {
        console.log('✅ Screening A created:', screenA.id);
        // Check auto-population
        if (screenA.franchise_id === franchiseAId && screenA.tenant_id === tenantId) {
            console.log('✅ SUCCESS: Tenant/Franchise IDs auto-populated correctly.');
        } else {
            console.error(`❌ FAILURE: Auto-population failed! Got T=${screenA.tenant_id}, F=${screenA.franchise_id}`);
        }
    }

    // Franchise B tries to read Screening A
    const { data: readScreenB } = await userFranchiseB.client
      .from('compliance_screenings')
      .select('*')
      .eq('id', screenA?.id);

    if (readScreenB && readScreenB.length > 0) {
        console.error(`❌ VIOLATION: Franchise B can see Screening A!`);
    } else {
        console.log('✅ SUCCESS: Franchise B cannot see Screening A.');
    }

    // =======================================================================
    // TEST 3: HQ VISIBILITY (HQ User accessing HQ Data)
    // =======================================================================
    console.log('\n[TEST 3] HQ Visibility');
    
    // Create HQ Account (franchise_id is NULL) using Tenant Admin
    const { data: hqAccount, error: accErr } = await userTenantAdmin.client
      .from('accounts')
      .insert({
        tenant_id: tenantId,
        franchise_id: null, // HQ Owned
        name: 'HQ Shared Account',
        account_type: 'customer'
      })
      .select()
      .single();
    
    if (accErr) console.error('❌ Failed to create HQ Account:', accErr);
    else console.log('✅ HQ Account created (franchise_id = NULL)');

    // HQ User (Standard) tries to read HQ Account
    const { data: visibleHQ, error: hqQueryErr } = await userHQ.client
      .from('accounts')
      .select('*')
      .eq('id', hqAccount?.id);

    if (hqQueryErr) {
        console.error('❌ Error querying accounts:', hqQueryErr);
    } else if (visibleHQ.length === 1) {
        console.log('✅ SUCCESS: HQ User can see HQ Account.');
    } else {
        console.error('❌ FAILURE: HQ User CANNOT see HQ Account (Gap Detected).');
    }

    // HQ User tries to read Franchise A Account (Create one first)
    const { data: faAccount } = await userFranchiseA.client
        .from('accounts')
        .insert({
            tenant_id: tenantId,
            franchise_id: franchiseAId,
            name: 'Franchise A Account',
            account_type: 'customer'
        })
        .select()
        .single();
    
    const { data: visibleFA } = await userHQ.client
        .from('accounts')
        .select('*')
        .eq('id', faAccount?.id);

    if (visibleFA && visibleFA.length > 0) {
        console.error('❌ VIOLATION: HQ User can see Franchise A Account!');
    } else {
        console.log('✅ SUCCESS: HQ User cannot see Franchise A Account.');
    }


  } catch (err) {
    console.error('❌ Test Suite Error:', err);
  } finally {
    // -----------------------------------------------------------------------
    // 3. CLEANUP
    // -----------------------------------------------------------------------
    console.log('\n--- Cleanup Phase ---');
    if (tenantId) {
        const { error } = await adminClient.from('tenants').delete().eq('id', tenantId);
        if (error) console.error('Failed to cleanup tenant:', error);
        else console.log('Cleanup successful.');
    }
    
    // Delete Auth Users
    const usersToDelete = [userTenantAdmin, userFranchiseA, userFranchiseB, userHQ];
    for (const u of usersToDelete) {
        if (u) await adminClient.auth.admin.deleteUser(u.id);
    }
    console.log('Users deleted.');
  }
}

runTest().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
