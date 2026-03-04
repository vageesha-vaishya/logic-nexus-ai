const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applySeed() {
  console.log('Applying seed migration for Delhi locations...');
  
  const migrationPath = path.resolve(__dirname, '../supabase/migrations/20260302130000_seed_delhi_locations.sql');
  
  try {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // We can't execute raw SQL via supabase-js directly unless we use a function or direct connection
    // However, since we have a direct connection string in .env (DATABASE_URL), let's use pg
    // But first let's check if we can use the same trick as before (postgres direct connection)
    
    // Check if we have DATABASE_URL
    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL not found in .env. Cannot apply migration directly.');
        process.exit(1);
    }

    const { Client } = require('pg');
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    await client.connect();
    
    try {
        await client.query(sql);
        console.log('Migration applied successfully via pg client.');
    } catch (err) {
        console.error('Error applying migration:', err);
    } finally {
        await client.end();
    }

  } catch (err) {
    console.error('Error reading migration file:', err);
  }
}

applySeed();
