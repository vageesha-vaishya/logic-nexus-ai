
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('Missing DB URL');
  process.exit(1);
}

async function checkTenantMismatches() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected.');

    // Check for quotes with NULL tenant_id
    const nullTenantQuotes = await client.query(`
      SELECT count(*) FROM quotes WHERE tenant_id IS NULL;
    `);
    console.log(`Quotes with NULL tenant_id: ${nullTenantQuotes.rows[0].count}`);

    // Check for versions with NULL tenant_id
    const nullTenantVersions = await client.query(`
      SELECT count(*) FROM quotation_versions WHERE tenant_id IS NULL;
    `);
    console.log(`Versions with NULL tenant_id: ${nullTenantVersions.rows[0].count}`);

    // Check for mismatches between quote and version tenant_id
    const mismatches = await client.query(`
      SELECT q.id as quote_id, q.quote_number, q.tenant_id as quote_tenant, qv.id as version_id, qv.tenant_id as version_tenant
      FROM quotes q
      JOIN quotation_versions qv ON q.id = qv.quote_id
      WHERE q.tenant_id IS DISTINCT FROM qv.tenant_id;
    `);
    
    console.log(`Mismatched tenant_id count: ${mismatches.rowCount}`);
    if (mismatches.rowCount > 0) {
      console.table(mismatches.rows.slice(0, 10));
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkTenantMismatches();
