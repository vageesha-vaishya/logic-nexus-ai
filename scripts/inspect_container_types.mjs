import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

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
  const migrationEnv = loadEnvMigration(projectRoot);
  let dbUrl = process.env.SUPABASE_DB_URL || migrationEnv.SUPABASE_DB_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;
  
  if (process.env.SUPABASE_POOLER_URL || migrationEnv.SUPABASE_POOLER_URL) {
    dbUrl = process.env.SUPABASE_POOLER_URL || migrationEnv.SUPABASE_POOLER_URL;
    if (dbUrl.includes('aws-0-ap-southeast-1.pooler.supabase.com')) {
      dbUrl = dbUrl.replace('aws-0-ap-southeast-1.pooler.supabase.com', 'aws-0-ap-southeast-2.pooler.supabase.com');
    }
  }

  if (!dbUrl) {
    console.error('Error: Database URL not found');
    process.exit(1);
  }

  const client = new Client({
    connectionString: dbUrl.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  });

  try {
    await client.connect();
    
    const query = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'container_types'
      ORDER BY ordinal_position;
    `;
    
    const res = await client.query(query);
    console.table(res.rows);
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
