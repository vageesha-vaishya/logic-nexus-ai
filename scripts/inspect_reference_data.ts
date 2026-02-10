import { Client } from 'pg';

const DIRECT_URL = 'postgresql://postgres.gzhxgoigflftharcmdqj:%23!January%232026!@aws-1-ap-south-1.pooler.supabase.com:5432/postgres';

async function inspectReferenceData() {
  const client = new Client({
    connectionString: DIRECT_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    console.log('\n--- Service Types Columns ---');
    const stCols = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'service_types';
    `);
    console.log(stCols.rows.map((r: any) => r.column_name));

    console.log('\n--- Service Types ---');
    // Query all columns since we don't know the exact names yet
    const serviceTypes = await client.query(`
      SELECT *
      FROM service_types 
      LIMIT 10;
    `);
    console.table(serviceTypes.rows);

    console.log('\n--- Services (Sample) ---');
    const services = await client.query(`
      SELECT id, service_name, service_type_id, service_type 
      FROM services 
      LIMIT 10;
    `);
    console.table(services.rows);

    console.log('\n--- Service Type Mappings ---');
    try {
        const mappings = await client.query(`
        SELECT * 
        FROM service_type_mappings 
        LIMIT 10;
        `);
        console.table(mappings.rows);
    } catch (e) {
        console.log('service_type_mappings table not found or error querying it.');
    }

    console.log('\n--- Quote Cargo Configurations Columns ---');
    const qccCols = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'quote_cargo_configurations';
    `);
    console.table(qccCols.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

inspectReferenceData();
