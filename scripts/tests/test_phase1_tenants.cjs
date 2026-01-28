const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is not defined in .env');
  process.exit(1);
}

const client = new Client({
  connectionString: DATABASE_URL,
});

async function cleanDatabase(client) {
  console.log('🧹 Cleaning database...');
  await client.query('DROP SCHEMA IF EXISTS public CASCADE');
  await client.query('CREATE SCHEMA public');
  await client.query('GRANT ALL ON SCHEMA public TO postgres');
  await client.query('GRANT ALL ON SCHEMA public TO public');
  // Re-create auth schema mocks if needed, but we assume we run on a fresh DB or one where auth exists.
  // For local testing without full Supabase, we might need to mock auth.users and auth.uid().
}

async function runSql(client, sql, description) {
  console.log(`Running: ${description}`);
  try {
    await client.query(sql);
  } catch (err) {
    console.error(`❌ Failed to run ${description}:`, err.message);
    throw err;
  }
}

async function getSchemaFiles() {
  const schemaDir = path.join(__dirname, '../../fixed_schema_parts');
  const files = fs.readdirSync(schemaDir)
    .filter(f => f.startsWith('schema_part_') && f.endsWith('.sql'))
    .sort();
  return files.map(f => path.join(schemaDir, f));
}

async function mockAuth(client) {
    console.log('🛠️ Mocking auth schema and functions for testing...');
    // Mock auth.uid() function if it doesn't exist (e.g. vanilla Postgres)
    await client.query(`
        CREATE SCHEMA IF NOT EXISTS auth;
        CREATE TABLE IF NOT EXISTS auth.users (
            id uuid PRIMARY KEY,
            email text,
            role text DEFAULT 'authenticated'
        );
        
        CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
            SELECT current_setting('request.jwt.claim.sub', true)::uuid;
        $$ LANGUAGE sql STABLE;
    `);
}

async function testPhase1() {
  try {
    await client.connect();
    
    // 1. Setup Environment
    await cleanDatabase(client);
    await mockAuth(client);

    // 2. Apply Migrations
    const files = await getSchemaFiles();
    for (const file of files) {
        const sql = fs.readFileSync(file, 'utf8');
        // We need to handle the fact that some scripts might reference auth.users which we mocked.
        await runSql(client, sql, `Applying ${path.basename(file)}`);
    }

    console.log('\n--- Verifying Phase 1: Multi-tenancy ---');

    // 3. Create Tenants
    const tenantA_ID = '11111111-1111-1111-1111-111111111111';
    const tenantB_ID = '22222222-2222-2222-2222-222222222222';
    
    // Fetch Domain IDs
    const domainRes = await client.query('SELECT id, code FROM public.platform_domains');
    const logisticsDomainId = domainRes.rows.find(d => d.code === 'LOGISTICS').id;
    const bankingDomainId = domainRes.rows.find(d => d.code === 'BANKING').id;

    await client.query(`
        INSERT INTO public.tenants (id, name, domain_id) VALUES 
        ($1, 'Logistics Corp', $2),
        ($3, 'Banking Inc', $4)
    `, [tenantA_ID, logisticsDomainId, tenantB_ID, bankingDomainId]);
    console.log('✅ Tenants created');

    // 4. Create Users (in auth.users and public.profiles)
    const userA_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const userB_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

    await client.query(`
        INSERT INTO auth.users (id, email) VALUES 
        ($1, 'userA@logistics.com'),
        ($2, 'userB@banking.com')
    `, [userA_ID, userB_ID]);

    await client.query(`
        INSERT INTO public.profiles (id, email, tenant_id) VALUES 
        ($1, 'userA@logistics.com', $3),
        ($2, 'userB@banking.com', $4)
    `, [userA_ID, userB_ID, tenantA_ID, tenantB_ID]);
    console.log('✅ Users created and linked to tenants');

    // 5. Test RLS: User A should only see Tenant A
    console.log('🔍 Testing RLS for User A...');
    
    // Simulate User A Session
    await client.query(`
        SET ROLE postgres; -- Reset first
        -- In a real Supabase env, we would switch to 'authenticated' role.
        -- But since we are owner, we need to enforce RLS manually or switch to a role that obeys it.
        -- For testing, we usually create a non-superuser role, but let's try to just use the session variable 
        -- and ensure the policy uses auth.uid().
        -- However, superusers bypass RLS. We need to create a test role.
    `);

    try {
        await client.query(`CREATE ROLE test_authenticated NOLOGIN;`);
    } catch (e) {} // Role might exist

    await client.query(`GRANT USAGE ON SCHEMA public TO test_authenticated;`);
    await client.query(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO test_authenticated;`);
    await client.query(`ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;`); // Ensure it's on

    // Switch to test role and set user ID
    await client.query(`SET ROLE test_authenticated;`);
    await client.query(`SET request.jwt.claim.sub = '${userA_ID}';`);

    const resA = await client.query('SELECT * FROM public.tenants');
    console.log(`User A sees ${resA.rows.length} tenants`);
    
    if (resA.rows.length === 1 && resA.rows[0].id === tenantA_ID) {
        console.log('✅ RLS Success: User A only sees their own tenant');
    } else {
        console.error('❌ RLS Failed: User A saw', resA.rows);
        throw new Error('RLS Verification Failed');
    }

    // 6. Test RLS: User B
    await client.query(`SET request.jwt.claim.sub = '${userB_ID}';`);
    const resB = await client.query('SELECT * FROM public.tenants');
    
    if (resB.rows.length === 1 && resB.rows[0].id === tenantB_ID) {
        console.log('✅ RLS Success: User B only sees their own tenant');
    } else {
        console.error('❌ RLS Failed: User B saw', resB.rows);
        throw new Error('RLS Verification Failed');
    }

    console.log('\n✅ Phase 1 Verification Completed Successfully');

  } catch (err) {
    console.error('❌ Test Failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

testPhase1();
