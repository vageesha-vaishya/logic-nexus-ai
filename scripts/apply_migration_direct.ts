
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('Missing SUPABASE_DB_URL or DATABASE_URL in .env');
  process.exit(1);
}

async function applyMigration() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false } // Required for Supabase
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    const migrationPath = process.argv[2] || '../supabase/migrations/20260216160000_add_source_attribution.sql';
    const migrationFile = path.resolve(process.cwd(), migrationPath);
    const sql = fs.readFileSync(migrationFile, 'utf8');

    console.log(`Applying migration: ${path.basename(migrationFile)}`);
    await client.query(sql);
    
    console.log('✅ Migration applied successfully.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
