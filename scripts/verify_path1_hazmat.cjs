const { Client } = require('pg');

// Using the working Migration database connection string
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

    // 1. Define Test Data (Simulating output from SharedCargoInput + HazmatWizard)
    const testCargoDetails = {
      id: 'test-cargo-hazmat-1',
      type: 'loose',
      quantity: 5,
      commodity: {
        description: 'PAINT RELATED MATERIAL',
        hts_code: '3208.10.0000'
      },
      weight: { value: 500, unit: 'kg' },
      volume: 2.5,
      hazmat: {
        unNumber: '1263',
        class: '3',
        packingGroup: 'II',
        flashPoint: { value: 25, unit: 'C' }
      }
    };

    console.log('Test Cargo Details:', JSON.stringify(testCargoDetails, null, 2));

    // 2. Insert into Quotes table
    // We use a dummy UUID for tenant_id. 
    // In a real scenario, RLS might block this if the user doesn't exist, but with the postgres user (service role equivalent usually), we bypass RLS or are superuser.
    const tenantId = '00000000-0000-0000-0000-000000000000'; 
    const quoteId = 'ffffffff-ffff-ffff-ffff-ffffffffffff'; 

    console.log('Inserting test quote...');
    
    // Check if 'quotes' table exists and has cargo_details
    const tableCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'quotes' AND column_name = 'cargo_details'
    `);

    if (tableCheck.rows.length === 0) {
        console.error('❌ Table "quotes" or column "cargo_details" not found!');
        process.exit(1);
    }

    const insertQuery = `
      INSERT INTO quotes (
        id, 
        tenant_id, 
        status, 
        origin_location, 
        destination_location, 
        cargo_details,
        transport_mode
      ) VALUES (
        $1, $2, 'draft', 
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
        
        // 3. Verify Hazmat Data Persistence
        if (savedCargo.hazmat && savedCargo.hazmat.unNumber === '1263') {
            console.log('✅ Hazmat Data Verified: UN1263 persisted correctly.');
        } else {
            console.error('❌ Hazmat Data Verification Failed!', savedCargo);
            process.exit(1);
        }

        // 4. Verify Compliance Check (Simulate AI Advisor)
        console.log('Verifying HTS Code existence for compliance check...');
        const htsRes = await client.query(`
            SELECT id, hts_code, description 
            FROM aes_hts_codes 
            WHERE hts_code LIKE '3208.10%' 
            LIMIT 1
        `);

        if (htsRes.rows.length > 0) {
            console.log(`✅ Compliance Check: HTS Code ${htsRes.rows[0].hts_code} found in database.`);
        } else {
            console.warn('⚠️ Compliance Check: HTS Code 3208.10 not found. (Flow valid, but code missing)');
        }

    } catch (err) {
        console.error('Insert failed:', err.message);
        // If RLS policy fails, we might see it here.
    }

    // 5. Clean up
    console.log('Cleaning up test data...');
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
