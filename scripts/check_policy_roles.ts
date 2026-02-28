
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('Missing SUPABASE_DB_URL or DATABASE_URL in .env');
  process.exit(1);
}

async function checkPolicyRoles() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    const resPolicies = await client.query(`
      SELECT policyname, roles
      FROM pg_policies
      WHERE tablename = 'quotation_versions'
      AND policyname = 'quotation_versions_manage';
    `);
    
    resPolicies.rows.forEach(row => {
        console.log(`Policy: ${row.policyname}`);
        console.log(`Roles: ${row.roles}`); // This usually prints {role1,role2} or {public} in PG
    });

  } catch (error) {
    console.error('Error checking schema:', error);
  } finally {
    await client.end();
  }
}

checkPolicyRoles();
