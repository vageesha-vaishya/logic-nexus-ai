const { Client } = require('pg');
require('dotenv').config();

const password = "#!January#2026!"; // Hardcoded from user input to be sure
const user = "postgres.gzhxgoigflftharcmdqj";
const host = "aws-1-ap-south-1.pooler.supabase.com";

async function test(port, mode) {
  console.log(`\nTesting ${mode} on port ${port}...`);
  const client = new Client({
    host,
    port,
    user,
    password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    console.log(`✅ Success! Connected to ${mode}.`);
    const res = await client.query('SELECT version()');
    console.log(res.rows[0]);
    await client.end();
  } catch (err) {
    console.error(`❌ Failed (${mode}):`, err.message);
  }
}

async function run() {
  await test(5432, "Session Mode");
  await test(6543, "Transaction Mode");
}

run();
