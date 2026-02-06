const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Missing DATABASE_URL in .env');
  process.exit(1);
}

const files = [
  'supabase/migrations/20260205131000_add_rail_to_enum.sql'
];

async function applyMigration() {
  console.log('Connecting to database...');
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected.');

    for (const fileRelPath of files) {
      const migrationFile = path.join(__dirname, fileRelPath);
      if (!fs.existsSync(migrationFile)) {
        console.error(`Migration file not found: ${migrationFile}`);
        continue;
      }
      
      console.log(`Reading migration: ${fileRelPath}`);
      const migrationSQL = fs.readFileSync(migrationFile, 'utf8');
      
      console.log(`Applying migration: ${fileRelPath}`);
      await client.query(migrationSQL);
      console.log(`Migration ${fileRelPath} applied successfully.`);
    }

  } catch (err) {
    console.error('Error executing migration:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
