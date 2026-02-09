const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

const migrationPath = path.join(__dirname, '../supabase/migrations/20260219030000_backfill_encryption.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

async function applyBackfill() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('🔌 Connected to database...');
    
    console.log('Running backfill migration: 20260219030000_backfill_encryption.sql');
    await client.query(sql);
    console.log('✅ Backfill applied successfully.');
    
  } catch (err) {
    console.error('❌ Backfill failed:', err);
  } finally {
    await client.end();
  }
}

applyBackfill();
