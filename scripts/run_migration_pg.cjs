
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Missing DATABASE_URL in .env');
  process.exit(1);
}

const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: node scripts/run_migration_pg.cjs <path/to/migration.sql>');
  process.exit(1);
}

const fullPath = path.resolve(process.cwd(), migrationFile);

if (!fs.existsSync(fullPath)) {
  console.error(`Migration file not found: ${fullPath}`);
  process.exit(1);
}

const migrationSQL = fs.readFileSync(fullPath, 'utf8');

async function applyMigration() {
  console.log('Connecting to database...');
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false } // Required for Supabase connection
  });

  try {
    await client.connect();
    console.log('Connected.');
    
    console.log(`Applying migration: ${migrationFile}`);
    await client.query(migrationSQL);
    console.log('Migration applied successfully.');
    
  } catch (err) {
    console.error('Error executing migration:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
