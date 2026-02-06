const { Client } = require('pg');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  // Try loading from .env.local if .env doesn't exist
  const envLocalPath = path.resolve(__dirname, '.env.local');
  if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
  }
}

const client = new Client({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkCarrierTypes() {
  try {
    await client.connect();
    console.log('Connected to database');

    const res = await client.query(`
      SELECT DISTINCT carrier_type FROM carriers ORDER BY carrier_type;
    `);
    
    console.log('Distinct carrier types in DB:');
    res.rows.forEach(row => {
      console.log(`- ${row.carrier_type}`);
    });

    const mappingCheck = await client.query(`
      SELECT id, carrier_name, carrier_type 
      FROM carriers 
      LIMIT 10;
    `);
    
    console.log('\nSample carriers:');
    mappingCheck.rows.forEach(row => {
      console.log(`${row.carrier_name}: ${row.carrier_type}`);
    });

  } catch (err) {
    console.error('Error querying database:', err);
  } finally {
    await client.end();
  }
}

checkCarrierTypes();
