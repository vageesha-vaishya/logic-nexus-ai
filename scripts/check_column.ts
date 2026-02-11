
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

const envLocalPath = path.resolve(__dirname, '../.env.local');
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envLocalPath });
dotenv.config({ path: envPath });

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'quotation_version_options' 
      AND column_name = 'notes';
    `);
    
    if (res.rows.length > 0) {
      console.log('Column "notes" exists in "quotation_version_options".');
    } else {
      console.log('Column "notes" DOES NOT EXIST in "quotation_version_options".');
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
