
const { Client } = require('pg');
require('dotenv').config();

async function checkTable() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error('Missing DATABASE_URL or POSTGRES_URL');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database');

    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'cargo_simulations';
    `);

    if (res.rows.length > 0) {
      console.log('✅ Table cargo_simulations exists.');
      
      const cols = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'cargo_simulations';
      `);
      console.log('Columns:', cols.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));
    } else {
      console.error('❌ Table cargo_simulations does NOT exist.');
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

checkTable();
