import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Load environment variables from .env first, then .env.migration as fallback
dotenv.config({ path: path.join(projectRoot, '.env') });

function loadEnvMigration(projectRoot) {
  const envPath = path.join(projectRoot, '.env.migration');
  if (fs.existsSync(envPath)) {
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
  return {};
}

async function main() {
  const sqlArg = process.argv[2];
  if (!sqlArg) {
    console.error('Usage: node scripts/run-sql.js /path/to/file.sql');
    process.exit(1);
  }

  // Try process.env first (from .env), then .env.migration
  const migrationEnv = loadEnvMigration(projectRoot);
  let dbUrl = process.env.SUPABASE_DB_URL || migrationEnv.SUPABASE_DB_URL;
  
  if (process.env.SUPABASE_POOLER_URL || migrationEnv.SUPABASE_POOLER_URL) {
    dbUrl = process.env.SUPABASE_POOLER_URL || migrationEnv.SUPABASE_POOLER_URL;
    // Attempt to fix region if incorrect (Sydney vs Singapore)
    if (dbUrl.includes('aws-0-ap-southeast-1.pooler.supabase.com')) {
      console.log('Switching pooler region from southeast-1 to southeast-2 (Sydney attempt)...');
      dbUrl = dbUrl.replace('aws-0-ap-southeast-1.pooler.supabase.com', 'aws-0-ap-southeast-2.pooler.supabase.com');
    }
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
