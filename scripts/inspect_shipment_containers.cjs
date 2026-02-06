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
      WHERE table_name = 'shipment_containers';
    `);
    console.log('Columns:', res.rows);

    const triggers = await client.query(`
      SELECT trigger_name, event_manipulation, event_object_table, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'shipment_containers';
    `);
    console.log('Triggers:', triggers.rows);
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

inspectTable();
