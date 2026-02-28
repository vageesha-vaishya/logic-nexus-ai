
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('Missing SUPABASE_DB_URL or DATABASE_URL in .env');
  process.exit(1);
}

const migrationFile = path.resolve(__dirname, '../supabase/migrations/20260227110000_fix_save_quote_atomic_columns.sql');

async function applyMigration() {
  console.log(`Applying migration: ${migrationFile}`);
  
  if (!fs.existsSync(migrationFile)) {
    console.error(`Migration file not found: ${migrationFile}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationFile, 'utf8');

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database.');
    await client.query(sql);
    console.log('Migration applied successfully.');
  } catch (error) {
    console.error('Error applying migration:', error);
  } finally {
    await client.end();
  }
}

applyMigration();
