import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres.gzhxgoigflftharcmdqj:%23!January%232026!@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    
    console.log("--- oauth_configurations schema ---");
    const res = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'oauth_configurations'
    `);
    console.table(res.rows);

    console.log("--- existing oauth configs ---");
    const oauth = await client.query(`SELECT id, provider, is_active, user_id, tenant_id FROM public.oauth_configurations LIMIT 5`);
    console.table(oauth.rows);

    await client.end();
  } catch (e) {
    console.error(e);
  }
}
run();
