const { Client } = require('pg');

const connectionString = 'postgresql://postgres.gzhxgoigflftharcmdqj:%23!January%232026!@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true';

async function verifyShipmentExecution() {
  console.log('--- Verifying Path 2: Shipment Execution & Documentation ---');
  
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    // 1. Get Tenant
    const tenantRes = await client.query('SELECT id FROM tenants LIMIT 1');
    if (tenantRes.rows.length === 0) throw new Error('No tenants found');
    const tenantId = tenantRes.rows[0].id;
    console.log('Using Tenant ID:', tenantId);

    const shipmentId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    const shipmentNumber = 'SH-TEST-001';

    // 2. Create Shipment
    console.log('Creating test shipment...');

    // Fetch valid shipment_type enum values
    let validShipmentType = 'standard'; // Default fallback
    try {
        const enumRes = await client.query("SELECT unnest(enum_range(NULL::shipment_type))");
        if (enumRes.rows.length > 0) {
            validShipmentType = enumRes.rows[0].unnest;
            console.log('Using valid shipment_type:', validShipmentType);
        }
    } catch (e) {
        console.warn('Could not fetch shipment_type enum, using default:', e.message);
    }

    const insertShipment = `
      INSERT INTO shipments (
        id, tenant_id, status, shipment_number,
        origin_address, destination_address,
        shipment_type
      ) VALUES (
        $1, $2, 'draft', $3,
        '{"address": "123 Test St, Origin City, Country"}', 
        '{"address": "456 Test Ave, Dest City, Country"}',
        $4
      )
      RETURNING id, shipment_number;
    `;

    try {
        await client.query(insertShipment, [shipmentId, tenantId, shipmentNumber, validShipmentType]);
        console.log('✅ Shipment created successfully.');
    } catch (err) {
        console.error('Shipment creation failed:', err.message);
        // If duplicate key (cleanup failed previously), try to delete first
        if (err.message.includes('duplicate key')) {
             await client.query('DELETE FROM shipments WHERE id = $1', [shipmentId]);
             await client.query(insertShipment, [shipmentId, tenantId, shipmentNumber, validShipmentType]);
             console.log('✅ Shipment created successfully (after cleanup).');
        } else {
             throw err;
        }
    }

    // 3. Add Cargo Items (Simulating what generates BOL/Packing List content)
    console.log('Adding cargo items...');
    const cargoId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
    const insertCargo = `
      INSERT INTO cargo_details (
        id, tenant_id, service_id, service_type,
        commodity_description, package_count, total_weight_kg, total_volume_cbm
      ) VALUES (
        $1, $2, $3, 'shipment',
        'ELECTRONIC COMPONENTS', 100, 500.5, 2.5
      )
      RETURNING id;
    `;

    await client.query(insertCargo, [cargoId, tenantId, shipmentId]);
    console.log('✅ Cargo items linked to shipment.');

    // 4. Verify Data Retrieval for Documents
    console.log('Verifying data retrieval for BOL/Packing List...');
    
    // Simulate fetching shipment + cargo
    const fetchRes = await client.query(`
        SELECT 
            s.shipment_number, 
            s.origin_address,
            c.commodity_description,
            c.package_count
        FROM shipments s
        JOIN cargo_details c ON c.service_id = s.id
        WHERE s.id = $1
    `, [shipmentId]);

    if (fetchRes.rows.length > 0) {
        const row = fetchRes.rows[0];
        console.log('Retrieved Data:', JSON.stringify(row, null, 2));
        if (row.commodity_description === 'ELECTRONIC COMPONENTS' && row.shipment_number === shipmentNumber) {
            console.log('✅ Data Integrity Verified: Ready for Document Generation.');
        } else {
            console.error('❌ Data Mismatch!');
        }
    } else {
        console.error('❌ Failed to retrieve linked shipment data.');
    }

    // 5. Cleanup
    console.log('Cleaning up...');
    await client.query('DELETE FROM cargo_details WHERE id = $1', [cargoId]);
    await client.query('DELETE FROM shipments WHERE id = $1', [shipmentId]);
    console.log('✅ Cleanup complete.');

  } catch (err) {
    console.error('Test Failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyShipmentExecution();
