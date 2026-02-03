
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envMigrationPath = path.join(__dirname, '../.env.migration');
if (fs.existsSync(envMigrationPath)) {
    dotenv.config({ path: envMigrationPath });
} else {
    dotenv.config();
}

let connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Missing SUPABASE_DB_URL or DATABASE_URL');
  process.exit(1);
}

async function verifyLandedCost() {
  console.log('Connecting to database...');
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false } 
  });

  try {
    await client.connect();
    console.log('Connected.');
    
    // Test calculate_landed_cost RPC
    // items: jsonb array of {hs_code, value, quantity, weight, origin_country}
    // destination_country: text
    
    const items = [
        {
            hs_code: '851762', // Example HS code (Smartphones/Comm devices)
            value: 1000,
            quantity: 1,
            weight: 0.5,
            origin_country: 'CN'
        }
    ];
    
    console.log('Testing calculate_landed_cost RPC...');
    const rpcRes = await client.query(`
        SELECT * FROM public.calculate_landed_cost($1::jsonb, $2::text);
    `, [JSON.stringify(items), 'US']);
    
    console.log('Landed Cost Result:', JSON.stringify(rpcRes.rows, null, 2));
    
  } catch (err) {
    console.error('Error verifying Landed Cost:', err);
  } finally {
    await client.end();
  }
}

verifyLandedCost();
