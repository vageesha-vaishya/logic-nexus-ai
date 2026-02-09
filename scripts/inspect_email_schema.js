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
    
    console.log("--- email_accounts schema ---");
    const res = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'email_accounts'
    `);
    console.table(res.rows);

    console.log("--- existing users ---");
    const users = await client.query(`SELECT id, email FROM auth.users LIMIT 5`);
    console.table(users.rows);

    await client.end();
  } catch (e) {
    console.error(e);
  }
}
run();
