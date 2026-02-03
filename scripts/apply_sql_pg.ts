import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set in .env');
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const migrationFile = process.argv[2];
if (!migrationFile) {
    console.error('Usage: tsx scripts/apply_sql_pg.ts <path_to_sql_file>');
    process.exit(1);
}

const filePath = path.resolve(process.cwd(), migrationFile);

if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
}

async function run() {
  try {
    await client.connect();
    console.log('Connected to DB');
    
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`Applying ${path.basename(filePath)}...`);
    
    await client.query(sql);
    console.log('Migration applied successfully!');
  } catch (err) {
    console.error('Error applying migration:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
