const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

const migrationPath = path.join(__dirname, '../supabase/migrations/20260219020000_encrypt_email_trigger.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

async function applyMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('🔌 Connected to database...');
    
    console.log('Running migration: 20260219020000_encrypt_email_trigger.sql');
    await client.query(sql);
    console.log('✅ Migration applied successfully.');
    
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await client.end();
  }
}

applyMigration();
