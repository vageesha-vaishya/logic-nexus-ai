
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    
    const funcName = process.argv[2];
    if (!funcName) {
        console.error('Provide function name');
        process.exit(1);
    }

    const res = await client.query(`SELECT pg_get_functiondef('${funcName}'::regproc)`);
    console.log(res.rows[0].pg_get_functiondef);
    
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
