import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load .env explicitly
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set in .env');
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const sqlFile = process.argv[2];
if (!sqlFile) {
    console.error('Usage: tsx scripts/query_sql.ts <path_to_sql_file>');
    process.exit(1);
}

const filePath = path.resolve(process.cwd(), sqlFile);

if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
}

async function run() {
  try {
    await client.connect();
    console.log('Connected to DB');
    
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`Executing ${path.basename(filePath)}...`);
    
    const result = await client.query(sql);
    console.log('Query executed successfully!');
    console.log('Rows:', result.rows);
    console.log('Row Count:', result.rowCount);
  } catch (err) {
    console.error('Error executing query:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
