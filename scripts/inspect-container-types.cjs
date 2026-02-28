require('dotenv').config();
const { Client } = require('pg');

async function inspect() {
  const connectionString = process.env.DIRECT_URL;
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected!');

    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'container_types';
    `);

    console.log('Columns in container_types:', res.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

inspect();
