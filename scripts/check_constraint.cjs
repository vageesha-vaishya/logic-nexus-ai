const { Client } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

async function checkConstraint() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  try {
    const res = await client.query(`
      SELECT conname, pg_get_constraintdef(oid)
      FROM pg_constraint
      WHERE conname = 'ports_locations_location_type_check';
    `);
    
    console.log('Constraint definition:', res.rows[0]);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

checkConstraint();
