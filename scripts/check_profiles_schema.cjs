const { Client } = require('pg');
try { require('dotenv').config(); } catch (e) {}
const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

async function checkProfiles() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles'");
  console.log('Columns:', res.rows.map(r => r.column_name));
  await client.end();
}
checkProfiles();
