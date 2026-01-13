import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnvMigration(projectRoot) {
  const envPath = path.join(projectRoot, '.env.migration');
  if (!fs.existsSync(envPath)) {
    throw new Error(`.env.migration not found at ${envPath}`);
  }
  const content = fs.readFileSync(envPath, 'utf-8');
  const map = {};
  content.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) {
      const key = m[1];
      let val = m[2];
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1);
      }
      map[key] = val;
    }
  });
  return map;
}

async function main() {
  const sqlArg = process.argv[2];
  if (!sqlArg) {
    console.error('Usage: node scripts/run-sql.js /path/to/file.sql');
    process.exit(1);
  }
  const projectRoot = path.join(__dirname, '..');
  const env = loadEnvMigration(projectRoot);
  let dbUrl = env.SUPABASE_DB_URL;
  if (env.SUPABASE_POOLER_URL) {
    dbUrl = env.SUPABASE_POOLER_URL;
  }
  if (!dbUrl) {
    console.error('Error: SUPABASE_DB_URL not found in .env.migration');
    process.exit(1);
  }

  // Build client from URL; enforce TLS without cert verification
  const client = new Client({
    connectionString: dbUrl.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false },
  });

  const sqlPath = path.isAbsolute(sqlArg) ? sqlArg : path.join(projectRoot, sqlArg);
  if (!fs.existsSync(sqlPath)) {
    console.error(`File not found: ${sqlPath}`);
    process.exit(1);
  }
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  try {
    console.log(`Connecting to database: ${dbUrl}`);
    await client.connect();
    console.log(`Executing: ${sqlPath}`);
    await client.query(sql);
    console.log('✅ SQL executed successfully');
  } catch (err) {
    console.error('❌ Error executing SQL:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
