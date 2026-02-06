
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || process.env.VITE_DATABASE_URL;

if (!connectionString) {
  console.error('No database connection string found (SUPABASE_DB_URL, DATABASE_URL, or VITE_DATABASE_URL).');
  process.exit(1);
}

const migrationFile = path.join(__dirname, '../supabase/migrations/20260218100000_add_vessel_info_to_shipments.sql');
const sql = fs.readFileSync(migrationFile, 'utf8');

console.log('Connecting to database...');
const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false } // Needed for Supabase usually
});

async function run() {
  try {
    await client.connect();
    console.log('Connected. Applying migration...');
    await client.query(sql);
    console.log('Migration applied successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
