const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const client = new Client({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function inspectTable() {
  await client.connect();
  try {
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'aes_hts_codes';
    `);
    console.log('Columns:', res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

inspectTable();
