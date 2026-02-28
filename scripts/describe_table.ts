
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config();

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

const tableName = process.argv[2] || 'quotes';

async function describeTable() {
  try {
    await client.connect();
    console.log(`Describing table: ${tableName}`);
    
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = $1 
      ORDER BY ordinal_position;
    `, [tableName]);
    
    console.table(res.rows);
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

describeTable();
