
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set in .env');
  process.exit(1);
}

async function getChargeData() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    const catRes = await client.query(`SELECT id, code, name FROM charge_categories LIMIT 5`);
    console.log('Categories:', JSON.stringify(catRes.rows, null, 2));

    const basisRes = await client.query(`SELECT id, code, name FROM charge_bases LIMIT 5`);
    console.log('Bases:', JSON.stringify(basisRes.rows, null, 2));

    const currencyRes = await client.query(`SELECT id, code FROM currencies LIMIT 2`);
    console.log('Currencies:', JSON.stringify(currencyRes.rows, null, 2));
    
    const sideRes = await client.query(`SELECT id, code, name FROM charge_sides LIMIT 2`);
    console.log('Sides:', JSON.stringify(sideRes.rows, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

getChargeData();
