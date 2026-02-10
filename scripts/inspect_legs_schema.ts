
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSchema() {
  console.log('Inspecting quotation_version_option_legs schema...');
  
  // We can't query information_schema via Supabase JS client easily due to permissions usually.
  // But we can try to insert a dummy record and see if it fails on unknown columns, 
  // OR we can just use the Postgres connection via `pg` library if we have the connection string.
  // The `apply_sql_pg.ts` uses `pg` and `DATABASE_URL`. Let's use that approach.
  
  const { Client } = await import('pg');
  
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
      console.error('DATABASE_URL is not set in .env');
      return;
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const res = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'quotation_version_option_legs'
        ORDER BY ordinal_position;
    `);
    
    console.log('Columns:');
    res.rows.forEach(row => {
        console.log(`- ${row.column_name} (${row.data_type})`);
    });
    
  } catch (err) {
      console.error('Error querying schema:', err);
  } finally {
      await client.end();
  }
}

inspectSchema();
