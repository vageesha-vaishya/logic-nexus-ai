const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Connection string from .env DIRECT_URL
// postgresql://postgres.gzhxgoigflftharcmdqj:%23!January%232026!@aws-1-ap-south-1.pooler.supabase.com:5432/postgres
// Note: The password contains encoded characters. %23 -> #
const connectionString = "postgresql://postgres.gzhxgoigflftharcmdqj:%23!January%232026!@aws-1-ap-south-1.pooler.supabase.com:5432/postgres";

console.log('Connecting to database...');
const client = new Client({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function applyMigration() {
  try {
    await client.connect();
    console.log('Connected successfully.');

    const migrationFile = path.join(__dirname, '../supabase/migrations/20260216200000_add_carrier_id_to_quote_options.sql');
    const sql = fs.readFileSync(migrationFile, 'utf8');

    console.log('Applying migration...');
    await client.query(sql);
    console.log('Migration applied successfully.');

  } catch (err) {
    console.error('Error applying migration:', err);
  } finally {
    await client.end();
  }
}

applyMigration();
