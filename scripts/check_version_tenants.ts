
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

async function checkVersionTenants() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    // Check for versions where tenant_id differs from quote's tenant_id
    const res = await client.query(`
      SELECT 
        qv.id as version_id, 
        qv.tenant_id as version_tenant_id,
        q.id as quote_id,
        q.tenant_id as quote_tenant_id,
        q.quote_number
      FROM quotation_versions qv
      JOIN quotes q ON qv.quote_id = q.id
      WHERE qv.tenant_id != q.tenant_id
    `);

    console.log(`Found ${res.rowCount} versions with mismatched tenant_id.`);
    
    if (res.rowCount > 0) {
      console.table(res.rows.slice(0, 10)); // Show first 10
      
      // Fix them
      console.log('Fixing mismatched tenant_ids...');
      const updateRes = await client.query(`
        UPDATE quotation_versions qv
        SET tenant_id = q.tenant_id
        FROM quotes q
        WHERE qv.quote_id = q.id
        AND qv.tenant_id != q.tenant_id
      `);
      console.log(`Fixed ${updateRes.rowCount} versions.`);
    }

  } catch (error) {
    console.error('Error checking version tenants:', error);
  } finally {
    await client.end();
  }
}

checkVersionTenants();
