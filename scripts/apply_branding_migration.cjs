const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
// No need for dotenv if using --env-file=.env, but keeping for compatibility
try { require('dotenv').config(); } catch (e) {}

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error('❌ Missing DATABASE_URL or SUPABASE_DB_URL');
  process.exit(1);
}

// Masked log
const masked = connectionString.replace(/:[^:@]+@/, ':****@');
console.log(`🔌 Connecting to: ${masked}`);

const migrationFile = path.join(__dirname, '../supabase/migrations/20260306000001_add_branding_configuration.sql');

if (!fs.existsSync(migrationFile)) {
    console.error(`❌ Migration file not found: ${migrationFile}`);
    process.exit(1);
}

const migrationSQL = fs.readFileSync(migrationFile, 'utf8');

async function checkColumns(client) {
    const res = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'quotation_configuration';
    `);
    console.log('📊 Current columns:', res.rows.map(r => r.column_name).join(', '));
}

async function applyMigration() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false } 
  });

  try {
    await client.connect();
    console.log('✅ Connected.');
    
    await checkColumns(client);

    console.log('🚀 Applying migration...');
    await client.query(migrationSQL);
    console.log('✅ Migration executed.');
    
    await checkColumns(client);
    
  } catch (err) {
    console.error('❌ Error executing migration:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
