
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env and .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('DATABASE_URL is not defined in .env.local');
  process.exit(1);
}

const tableName = process.argv[2] || 'quotation_versions';

async function inspectSchema() {
  console.log(`Connecting to database... (Target: ${tableName})`);
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected.');

    const res = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = $1
      ORDER BY ordinal_position;
    `, [tableName]);

    console.log(`Columns in ${tableName}:`);
    console.table(res.rows);

    // Foreign Keys
    const fks = await client.query(`
        SELECT
            kcu.column_name, 
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name 
        FROM 
            information_schema.key_column_usage AS kcu
            JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = kcu.constraint_name
            JOIN information_schema.table_constraints AS tc
            ON tc.constraint_name = kcu.constraint_name
        WHERE kcu.table_name = $1 AND tc.constraint_type = 'FOREIGN KEY';
    `, [tableName]);
    console.log(`Foreign Keys in ${tableName}:`);
    console.table(fks.rows);

    const policies = await client.query(`
      SELECT policyname, cmd, roles, qual, with_check
      FROM pg_policies
      WHERE tablename = $1;
    `, [tableName]);
    console.log(`Policies on ${tableName}:`);
    console.table(policies.rows);

  } catch (error) {
    console.error('Error inspecting schema:', error);
  } finally {
    await client.end();
  }
}

inspectSchema();
