
const { Client } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

// Load env
const envLocalPath = path.resolve(__dirname, '../.env.local');
const envPath = path.resolve(__dirname, '../.env');
require('dotenv').config({ path: envLocalPath });
require('dotenv').config({ path: envPath });

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to DB');
    
    console.log('Adding notes column...');
    await client.query(`
      ALTER TABLE quotation_version_options 
      ADD COLUMN IF NOT EXISTS notes TEXT;
    `);
    
    console.log('Migration executed.');
    
    // Verify
    const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'quotation_version_options' 
      AND column_name = 'notes';
    `);
    
    if (res.rows.length > 0) {
      console.log('SUCCESS: Column "notes" exists.');
    } else {
      console.error('FAILURE: Column "notes" still does not exist.');
    }
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
