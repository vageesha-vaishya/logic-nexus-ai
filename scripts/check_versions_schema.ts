
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
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

async function checkSchema() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    // Check columns
    console.log('\nColumns in quotation_versions:');
    const resColumns = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'quotation_versions'
      ORDER BY ordinal_position;
    `);
    
    // Print manually to avoid truncation issues with console.table
    resColumns.rows.forEach(row => {
        console.log(`${row.column_name.padEnd(20)} | ${row.data_type.padEnd(20)} | Default: ${row.column_default} | Nullable: ${row.is_nullable}`);
    });

    // Check policies
    console.log('\nPolicies on quotation_versions:');
    const resPolicies = await client.query(`
      SELECT policyname, cmd, roles, qual, with_check
      FROM pg_policies
      WHERE tablename = 'quotation_versions';
    `);
    
    resPolicies.rows.forEach(row => {
        console.log(`Policy: ${row.policyname}`);
        console.log(`  Cmd: ${row.cmd}`);
        console.log(`  Qual: ${row.qual}`);
        console.log(`  With Check: ${row.with_check}`);
        console.log('---');
    });

  } catch (error) {
    console.error('Error checking schema:', error);
  } finally {
    await client.end();
  }
}

checkSchema();
