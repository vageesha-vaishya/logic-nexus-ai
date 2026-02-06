const { Client } = require('pg');

const connectionString = 'postgresql://postgres.gzhxgoigflftharcmdqj:%23!January%232026!@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true';

async function verifyAnalytics() {
  console.log('--- Verifying Path 3: Dashboard Analytics ---');
  
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    // 1. Get a valid User ID to simulate context
    const userRes = await client.query('SELECT id FROM auth.users LIMIT 1');
    if (userRes.rows.length === 0) throw new Error('No users found');
    const userId = userRes.rows[0].id;
    console.log('Using User ID:', userId);

    // 2. Set Context (Simulating Supabase Auth)
    // This allows RLS policies and functions using auth.uid() to work
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [userId]);
    await client.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({sub: userId, role: 'authenticated'})]);
    console.log('Auth context set.');

    // 3. Call get_dashboard_stats RPC
    console.log('Calling get_dashboard_stats()...');
    try {
        const statsRes = await client.query('SELECT * FROM get_dashboard_stats()');
        console.log('Dashboard Stats Result:', JSON.stringify(statsRes.rows, null, 2));
        
        if (statsRes.rows.length > 0) {
            console.log('✅ get_dashboard_stats RPC returned data.');
        } else {
            console.warn('⚠️ get_dashboard_stats RPC returned empty array (might be valid if no data).');
        }
    } catch (err) {
        console.error('❌ get_dashboard_stats RPC failed:', err.message);
    }

    // 4. Call get_financial_metrics RPC
    console.log('Calling get_financial_metrics()...');
    try {
        const finRes = await client.query("SELECT * FROM get_financial_metrics('12m')");
        console.log('Financial Metrics Result (first 2):', JSON.stringify(finRes.rows.slice(0, 2), null, 2));
        console.log('✅ get_financial_metrics RPC execution successful.');
    } catch (err) {
        console.error('❌ get_financial_metrics RPC failed:', err.message);
    }

  } catch (err) {
    console.error('Test Failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyAnalytics();
