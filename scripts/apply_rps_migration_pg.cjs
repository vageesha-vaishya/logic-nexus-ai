
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load .env.migration if it exists, otherwise .env
const envMigrationPath = path.join(__dirname, '../.env.migration');
if (fs.existsSync(envMigrationPath)) {
    dotenv.config({ path: envMigrationPath });
} else {
    dotenv.config();
}

// Prefer SUPABASE_DB_URL, fallback to DATABASE_URL
let connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Missing SUPABASE_DB_URL or DATABASE_URL');
  process.exit(1);
}

// Fix pgbouncer param if present (pg client might not like it or handles it, but let's be safe)
// Actually pg client ignores params it doesn't know usually, but pgbouncer=true is for Supabase transaction mode.
// We want session mode for migrations usually? No, transaction mode (port 6543) is fine for single statements, 
// but for migrations involving multiple statements or transactions, session mode (port 5432) is preferred if available.
// However, the provided URL uses 6543. Let's try as is.

const files = [
    '../supabase/migrations/20260205100000_compliance_screening_module.sql',
    '../supabase/migrations/20260205100500_seed_restricted_parties.sql'
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
    
    for (const file of files) {
        const migrationFile = path.join(__dirname, file);
        if (!fs.existsSync(migrationFile)) {
            console.error(`Migration file not found: ${migrationFile}`);
            process.exit(1);
        }
        
        console.log(`Applying ${file}...`);
        const migrationSQL = fs.readFileSync(migrationFile, 'utf8');

        await client.query(migrationSQL);
        console.log(`Success: ${file}`);
    }
    
    console.log('All migrations applied successfully.');
    
  } catch (err) {
    console.error('Error executing migration:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
