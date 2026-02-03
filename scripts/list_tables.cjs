
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envMigrationPath = path.join(__dirname, '../.env.migration');
if (fs.existsSync(envMigrationPath)) {
    dotenv.config({ path: envMigrationPath });
} else {
    dotenv.config();
}

let connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Missing SUPABASE_DB_URL or DATABASE_URL');
  process.exit(1);
}

async function listTables() {
  console.log('Connecting to database...');
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false } 
  });

  try {
    await client.connect();
    console.log('Connected.');
    
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name ILIKE '%user%' OR table_name ILIKE '%profile%' OR table_name ILIKE '%staff%' OR table_name ILIKE '%member%')
      ORDER BY table_name;
    `);
    
    console.log('User-related tables in public schema:', res.rows.map(r => r.table_name));
    
  } catch (err) {
    console.error('Error inspecting tables:', err);
  } finally {
    await client.end();
  }
}

listTables();
