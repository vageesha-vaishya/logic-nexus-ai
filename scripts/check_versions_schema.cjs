const { Client } = require('pg');
try { require('dotenv').config(); } catch (e) {}
const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

async function checkVersions() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'quotation_versions'");
  console.log('Columns:', res.rows);
  await client.end();
}
checkVersions();
