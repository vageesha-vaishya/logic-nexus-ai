
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { Client } from 'pg';
import * as fs from 'fs';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const connectionString = process.env.DATABASE_URL; // Using DATABASE_URL for direct connection

if (!connectionString) {
  console.error('DATABASE_URL is not set in .env');
  process.exit(1);
}

async function getFunctionDefinition(functionName: string) {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    const query = `
      SELECT pg_get_functiondef(oid) as definition
      FROM pg_proc
      WHERE proname = $1;
    `;
    
    const result = await client.query(query, [functionName]);
    
    if (result.rows.length === 0) {
      console.log(`Function ${functionName} not found.`);
    } else {
      fs.writeFileSync('temp_function_def.sql', result.rows[0].definition);
      console.log('Function definition written to temp_function_def.sql');
    }
    
  } catch (error) {
    console.error('Error fetching function definition:', error);
  } finally {
    await client.end();
  }
}

const functionName = process.argv[2] || 'save_quote_atomic';
getFunctionDefinition(functionName);
