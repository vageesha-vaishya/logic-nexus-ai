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
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'container_sizes';
    `);
    console.log('container_sizes exists:', res.rows.length > 0);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

inspect();
