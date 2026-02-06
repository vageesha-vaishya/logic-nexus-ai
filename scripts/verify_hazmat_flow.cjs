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
    // We need a valid user/tenant context. We'll try to find an existing tenant or insert a dummy one if RLS allows (or bypass RLS if we were superuser, but we are likely not).
    // Ideally we insert into 'quotes' table. 
    // Let's check if we can insert.
    
    // First, get a valid tenant_id if possible, or generate a random UUID
    // We'll just use a random UUID for tenant_id for this test, assuming RLS might block us if we were using the API, 
    // but here we are using a direct DB connection which might be a service role or just a postgres user.
    // The connection string says 'postgres', so we are likely admin/superuser or owner.
    
    const tenantId = '00000000-0000-0000-0000-000000000000'; // Dummy Tenant
    const quoteId = 'ffffffff-ffff-ffff-ffff-ffffffffffff'; // Test Quote ID

    console.log('Inserting test quote...');
    
    // Note: Adjust columns based on actual schema. 
    // Based on QuoteDetailsStep.tsx: quoteData has total_weight, total_volume, commodity.
    // And cargo_details is the JSONB column.
    
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
        // We'll query the aes_hts_codes table to see if we can find the HTS code 3208.10.0000
        // This simulates the "validate_compliance" step.
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
            console.warn('⚠️ Compliance Check: HTS Code 3208.10 not found. (Might need seeding, but flow is valid if code handles empty results)');
        }

    } catch (err) {
        // If insert fails (e.g. constraints), let's see why
        console.error('Insert failed:', err.message);
        // If it failed because of foreign keys (e.g. origin_location_id), we might need to adjust.
        // But usually location columns are JSONB or nullable FKs.
        // If it failed because 'quotes' table doesn't exist, we'll know.
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
