
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString) {
  console.error('Missing DATABASE_URL or POSTGRES_URL in .env');
  process.exit(1);
}

const migrations = [
  '../supabase/migrations/20260218100000_add_vessel_info_to_shipments.sql',
  '../supabase/migrations/20260218120000_create_cargo_simulations.sql'
];

async function applyMigrations() {
  console.log('Connecting to database...');
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false } 
  });

  try {
    await client.connect();
    console.log('Connected.');
    
    for (const migrationPath of migrations) {
      const fullPath = path.join(__dirname, migrationPath);
      if (!fs.existsSync(fullPath)) {
        console.error(`Migration file not found: ${fullPath}`);
        continue;
      }
      
      console.log(`Applying migration: ${path.basename(fullPath)}...`);
      const migrationSQL = fs.readFileSync(fullPath, 'utf8');
      await client.query(migrationSQL);
      console.log('Success.');
    }
    
    console.log('All migrations applied successfully.');
    
  } catch (err) {
    console.error('Error executing migration:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigrations();
