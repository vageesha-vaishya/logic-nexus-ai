
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
    
    // Check columns
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'quotation_version_options'
      ORDER BY column_name;
    `);
    
    console.log('Columns in quotation_version_options:');
    res.rows.forEach(r => console.log(`- ${r.column_name} (${r.data_type})`));
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
