import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const migrationFile = path.join(__dirname, '..', 'supabase', 'migrations', '20260204010000_granular_logistics_types.sql');

async function runMigration() {
  console.log('🚀 Applying Granular Logistics Types Migration...');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not found in .env');
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to Database');

    const sql = fs.readFileSync(migrationFile, 'utf8');
    console.log(`📄 Read migration file: ${path.basename(migrationFile)}`);

    await client.query(sql);
    console.log('✅ Migration applied successfully!');

  } catch (err) {
    console.error('❌ Migration Failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
