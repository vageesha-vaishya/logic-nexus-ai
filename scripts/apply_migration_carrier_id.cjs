const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || process.env.TARGET_DB_URL;

if (!connectionString) {
  console.error('Missing database connection string (SUPABASE_DB_URL or DATABASE_URL)');
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function applyMigration() {
  const migrationPath = path.join(__dirname, '../supabase/migrations/20260212100000_add_carrier_id_to_options.sql');
  
  try {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log('Connecting to database...');
    await client.connect();
    
    console.log('Applying migration...');
    await client.query(sql);
    
    console.log('Migration applied successfully.');
  } catch (error) {
    console.error('Error applying migration:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
