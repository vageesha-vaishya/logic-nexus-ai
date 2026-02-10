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
    
    const res = await client.query(`
      SELECT pg_get_constraintdef(oid) AS constraint_def
      FROM pg_constraint
      WHERE conname = 'email_accounts_provider_check'
    `);
    
    console.log("Constraint Definition:");
    res.rows.forEach(r => console.log(r.constraint_def));

    await client.end();
  } catch (e) {
    console.error(e);
  }
}
run();
