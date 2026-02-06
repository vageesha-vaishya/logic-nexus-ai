const { Client } = require('pg');

const connectionString = 'postgresql://postgres.gzhxgoigflftharcmdqj:%23!January%232026!@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true';

async function verifyHazmatFlow() {
  console.log('--- Verifying Path 1: Hazmat Wizard Flow ---');
  
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    const testCargoDetails = {
      id: 'test-cargo-hazmat-1',
      type: 'loose',
      quantity: 5,
      commodity: { description: 'PAINT RELATED MATERIAL', hts_code: '3208.10.0000' },
      weight: { value: 500, unit: 'kg' },
      volume: 2.5,
      hazmat: { unNumber: '1263', class: '3', packingGroup: 'II', flashPoint: { value: 25, unit: 'C' } }
    };

    console.log('Fetching valid tenant_id...');
    const tenantRes = await client.query('SELECT id FROM tenants LIMIT 1');
    let tenantId;
    if (tenantRes.rows.length > 0) {
        tenantId = tenantRes.rows[0].id;
        console.log('Using Tenant ID:', tenantId);
    } else {
        console.warn('No tenants found! Using dummy, but expect failure.');
        tenantId = '00000000-0000-0000-0000-000000000000';
    }
    
    const quoteId = 'ffffffff-ffff-ffff-ffff-ffffffffffff'; 

    console.log('Inserting test quote...');
    
    const insertQuery = `
      INSERT INTO quotes (
        id, 
        tenant_id, 
        status, 
        title,
        origin_location, 
        destination_location, 
        cargo_details,
        transport_mode
      ) VALUES (
        $1, $2, 'draft', 
        'Hazmat Test Quote',
        '{"name": "Test Origin"}', 
        '{"name": "Test Dest"}', 
        $3,
        'ocean'
      )
      RETURNING id, cargo_details;
    `;

    try {
        const res = await client.query(insertQuery, [quoteId, tenantId, testCargoDetails]);
        console.log('✅ Quote inserted successfully.');
        const savedCargo = res.rows[0].cargo_details;
        
        if (savedCargo.hazmat && savedCargo.hazmat.unNumber === '1263') {
            console.log('✅ Hazmat Data Verified: UN1263 persisted correctly.');
        } else {
            console.error('❌ Hazmat Data Verification Failed!', savedCargo);
            process.exit(1);
        }

        console.log('Verifying HTS Code existence...');
        const htsRes = await client.query(`SELECT id, hts_code FROM aes_hts_codes WHERE hts_code LIKE '3208.10%' LIMIT 1`);
        if (htsRes.rows.length > 0) {
            console.log(`✅ Compliance Check: HTS Code found.`);
        } else {
            console.warn('⚠️ Compliance Check: HTS Code not found.');
        }

    } catch (err) {
        console.error('Insert failed:', err.message);
    }

    console.log('Cleaning up...');
    await client.query('DELETE FROM quotes WHERE id = $1', [quoteId]);
    console.log('✅ Cleanup complete.');

  } catch (err) {
    console.error('Test Failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyHazmatFlow();
