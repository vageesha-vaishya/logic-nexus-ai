
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Missing DATABASE_URL in .env');
  process.exit(1);
}

const migrationFile = path.join(__dirname, '../supabase/migrations/20260207000000_update_invoice_rpc_with_duty.sql');

if (!fs.existsSync(migrationFile)) {
    console.error(`Migration file not found: ${migrationFile}`);
    process.exit(1);
}

const migrationSQL = fs.readFileSync(migrationFile, 'utf8');

async function applyMigration() {
  console.log('Connecting to database...');
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false } // Required for Supabase connection
  });

  try {
    await client.connect();
    console.log('Connected.');
    
    console.log(`Applying migration file: ${path.basename(migrationFile)}...`);
    await client.query(migrationSQL);
    console.log('Migration applied successfully.');
    
    // Also record it in supabase_migrations if possible, but optional
    // We'll skip that for now as we just want the RPC up.
    
  } catch (err) {
    console.error('Error executing migration:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
