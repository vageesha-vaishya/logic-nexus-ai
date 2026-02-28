require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
  const connectionString = process.env.DIRECT_URL;
  if (!connectionString) {
    console.error('DIRECT_URL not found in .env');
    process.exit(1);
  }

  console.log('Connecting to database...');
  
  // Parse connection details for debugging (masking password)
  const url = new URL(connectionString);
  console.log(`Host: ${url.hostname}`);
  console.log(`User: ${url.username}`);
  console.log(`Port: ${url.port}`);
  console.log(`Database: ${url.pathname.slice(1)}`);

  // Disable prepared statements just in case we are behind a transaction pooler
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }, // Often needed for Supabase
  });

  try {
    await client.connect();
    console.log('Connected!');

    const migrationPath = path.join(__dirname, '../supabase/migrations/20260227000003_fix_quote_numbering_permissions.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration...');
    await client.query(sql);
    console.log('Migration applied successfully!');

  } catch (err) {
    console.error('Error running migration:', err);
  } finally {
    await client.end();
  }
}

run();
