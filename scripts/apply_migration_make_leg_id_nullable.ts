
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const applyMigration = async () => {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('DATABASE_URL is not defined in .env');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database');

    const migrationPath = path.resolve(__dirname, '../supabase/migrations/20260228143000_make_leg_id_nullable.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Applying migration...');
    await client.query(migrationSql);
    console.log('Migration applied successfully!');

  } catch (err) {
    console.error('Error applying migration:', err);
  } finally {
    await client.end();
  }
};

applyMigration();
