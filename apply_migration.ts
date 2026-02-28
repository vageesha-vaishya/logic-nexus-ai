
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set in .env');
  process.exit(1);
}

const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

async function applyMigration() {
  try {
    await client.connect();
    
    const migrationPath = path.join(__dirname, 'supabase/migrations/20260228140000_fix_save_quote_atomic_charge_basis.sql');
    console.log('Reading migration file:', migrationPath);
    
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Applying migration...');
    await client.query(migrationSql);
    console.log('Migration applied successfully.');

  } catch (error) {
    console.error('Error applying migration:', error);
  } finally {
    await client.end();
  }
}

applyMigration();
