const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Missing DATABASE_URL in .env');
  process.exit(1);
}

const query = process.argv[2];

if (!query) {
  console.error('Usage: node scripts/run_query_pg.cjs "SELECT * FROM ..."');
  process.exit(1);
}

async function runQuery() {
  console.log('Connecting to database...');
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected.');
    
    console.log(`Executing query: ${query}`);
    const res = await client.query(query);
    console.log('Result rows:', JSON.stringify(res.rows, null, 2));
    
  } catch (err) {
    console.error('Error executing query:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runQuery();
