
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

async function listTables() {
  try {
    await client.connect();
    console.log('Connected to database.');
    
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('Tables in public schema:');
    res.rows.forEach(row => {
      console.log(`- ${row.table_name}`);
    });
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

listTables();
