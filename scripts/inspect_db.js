
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL not found in .env');
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to database');

    const sql = process.argv[2];
    if (!sql) {
        console.error('Please provide SQL query as argument');
        process.exit(1);
    }

    console.log(`Executing: ${sql}`);
    const res = await client.query(sql);
    console.log('Result:', JSON.stringify(res.rows, null, 2));

  } catch (err) {
    console.error('Error executing query:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
