const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  const envMigrationPath = path.resolve(__dirname, '../.env.migration');
  
  const paths = [envPath, envMigrationPath];
  const env = {};

  paths.forEach(p => {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf-8');
      content.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim().replace(/^['"]|['"]$/g, '');
          env[key] = value;
        }
      });
    }
  });
  return env;
}

const env = loadEnv();
// Use Pooler URL as direct DB URL seems to have DNS issues
let connectionString = env.SUPABASE_POOLER_URL;

if (!connectionString) {
  // Fallback to DB URL if Pooler not found
  connectionString = env.SUPABASE_DB_URL;
}

if (!connectionString) {
  console.error('Missing SUPABASE_POOLER_URL or SUPABASE_DB_URL in .env or .env.migration');
  process.exit(1);
}

console.log('Using connection string (masked):', connectionString.replace(/:[^:@]+@/, ':****@'));

// Handle SSL self-signed certs if needed (common in some setups)
const client = new Client({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function applyFix() {
  const sqlPath = path.join(__dirname, '../supabase/migrations/20260121000005_fix_carrier_rates_schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Connecting to database...');
  try {
    await client.connect();
    console.log('Connected.');

    console.log('Applying migration...');
    await client.query(sql);
    console.log('Migration applied successfully.');

    // Verify
    console.log('Verifying carrier_rates columns...');
    const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'carrier_rates' AND column_name = 'account_id'");
    
    if (res.rows.length > 0) {
      console.log('SUCCESS: account_id column found in carrier_rates.');
    } else {
      console.log('FAILURE: account_id column NOT found in carrier_rates.');
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

applyFix();
