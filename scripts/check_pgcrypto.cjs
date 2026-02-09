const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkExtension() {
  await client.connect();
  const res = await client.query("select extname, nspname from pg_extension join pg_namespace on pg_extension.extnamespace = pg_namespace.oid where extname = 'pgcrypto'");
  console.log(res.rows);
  await client.end();
}

checkExtension();
