
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('Error: SUPABASE_DB_URL or DATABASE_URL not found in .env');
  console.log('Please ensure your .env file contains the database connection string.');
  process.exit(1);
}

const migrationFile = path.join(PROJECT_ROOT, 'supabase', 'migrations', '20260201190000_fix_vendor_rls.sql');

if (!fs.existsSync(migrationFile)) {
  console.error(`Error: Migration file not found at ${migrationFile}`);
  process.exit(1);
}

const sql = fs.readFileSync(migrationFile, 'utf8');

async function applyMigration() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false } // Supabase usually requires SSL
  });

  try {
    await client.connect();
    console.log('Connected to database.');
    
    console.log('Applying migration: 20260201190000_fix_vendor_rls.sql');
    await client.query(sql);
    
    console.log('Migration applied successfully.');
    
    // Optional: Update supabase_migrations table to avoid re-running if db push is used later
    // Check if table exists first
    const checkTable = await client.query(`
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'supabase_migrations' 
            AND table_name = 'schema_migrations'
        );
    `);
    
    if (checkTable.rows[0].exists) {
        await client.query(`
            INSERT INTO supabase_migrations.schema_migrations (version)
            VALUES ('20260201190000')
            ON CONFLICT (version) DO NOTHING;
        `);
        console.log('Recorded migration version.');
    } else {
        console.log('supabase_migrations table not found, skipping version recording.');
    }

  } catch (err) {
    console.error('Error applying migration:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
