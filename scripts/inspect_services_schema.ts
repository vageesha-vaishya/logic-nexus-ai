
import { Client } from 'pg';

const DIRECT_URL = 'postgresql://postgres.gzhxgoigflftharcmdqj:%23!January%232026!@aws-1-ap-south-1.pooler.supabase.com:5432/postgres';

async function inspectSchema() {
  const client = new Client({
    connectionString: DIRECT_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'services';
    `);
    console.log('Services Table Columns:', res.rows.map(r => r.column_name));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

inspectSchema();
