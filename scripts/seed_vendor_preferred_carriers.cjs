const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function seed() {
  try {
    await client.connect();
    console.log('Connected to DB');

    // 1. Get Vendors
    const vendorsRes = await client.query(`SELECT id, name, tenant_id FROM vendors LIMIT 10`);
    const vendors = vendorsRes.rows;
    if (vendors.length === 0) {
        console.log('No vendors found. Creating a test vendor...');
        const tenantRes = await client.query('SELECT id FROM tenants LIMIT 1');
        if (tenantRes.rows.length === 0) {
            console.error('No tenants found. Cannot create vendor.');
            return;
        }
        const tenantId = tenantRes.rows[0].id;
        const insertVendor = await client.query(`
            INSERT INTO vendors (tenant_id, name, type, is_active)
            VALUES ($1, 'Global Logistics Partners', 'freight_forwarder', true)
            RETURNING id, name, tenant_id
        `, [tenantId]);
        vendors.push(insertVendor.rows[0]);
    }

    // 2. Ensure Rail Carriers Exist
    const railCheck = await client.query(`
        SELECT id, carrier_name FROM carriers 
        WHERE mode = 'rail' OR carrier_type = 'rail' OR carrier_type = 'railway_transport'
    `);
    
    if (railCheck.rows.length === 0) {
        console.log('No rail carriers found. Seeding rail carriers...');
        const tenantId = vendors[0].tenant_id; // Use first vendor's tenant
        
        const railCarriers = [
            { name: 'Union Pacific', scac: 'UP' },
            { name: 'BNSF Railway', scac: 'BNSF' },
            { name: 'CSX Transportation', scac: 'CSXT' },
            { name: 'Norfolk Southern', scac: 'NS' }
        ];

        for (const rc of railCarriers) {
            await client.query(`
                INSERT INTO carriers (tenant_id, carrier_name, mode, carrier_type, scac, is_active)
                VALUES ($1, $2, 'rail', 'rail', $3, true)
                ON CONFLICT DO NOTHING
            `, [tenantId, rc.name, rc.scac]);
        }
    }

    // 3. Get Carriers by mode
    const modes = ['ocean', 'air', 'road', 'rail'];
    const carrierMap = {};

    for (const mode of modes) {
        let query = `SELECT id, carrier_name FROM carriers WHERE mode = $1::transport_mode LIMIT 10`;
        // Handle rail specific logic or type mismatches
        if (mode === 'rail') {
             // Try to match both if schema is mixed, but with enum strictness, we just check the enum value.
             // If carrier_type is also used, we check it too (assuming carrier_type is text or compatible).
             // Let's assume carrier_type is text or check constraint.
             query = `SELECT id, carrier_name FROM carriers WHERE mode = 'rail'::transport_mode OR carrier_type = 'rail' LIMIT 10`;
        } else if (mode === 'road') {
            // road might be 'trucking' in some places or 'inland_trucking'
            // We cast column to text to avoid enum errors if checking for non-enum values
            query = `SELECT id, carrier_name FROM carriers WHERE mode = 'road'::transport_mode OR mode::text = 'trucking' LIMIT 10`;
        }
        
        try {
            const res = await client.query(query, mode === 'rail' || mode === 'road' ? [] : [mode]);
            carrierMap[mode] = res.rows;
            console.log(`Found ${res.rows.length} carriers for mode ${mode}`);
        } catch (e) {
            console.log(`Error fetching carriers for mode ${mode}: ${e.message}. Trying text fallback.`);
             // Fallback to text cast if enum fails (e.g. if column is text)
             const textQuery = `SELECT id, carrier_name FROM carriers WHERE mode::text = $1 LIMIT 10`;
             const res = await client.query(textQuery, [mode]);
             carrierMap[mode] = res.rows;
             console.log(`Found ${res.rows.length} carriers for mode ${mode} (fallback)`);
        }
    }

    // 4. Insert preferences
    console.log('Seeding vendor preferences...');
    for (const vendor of vendors) {
        for (const mode of modes) {
            const carriers = carrierMap[mode];
            if (carriers && carriers.length > 0) {
                // Pick 1-3 random carriers
                const count = Math.floor(Math.random() * 3) + 1;
                const shuffled = [...carriers].sort(() => 0.5 - Math.random());
                const selected = shuffled.slice(0, count);
                
                for (const carrier of selected) {
                    await client.query(`
                        INSERT INTO vendor_preferred_carriers (vendor_id, carrier_id, mode)
                        VALUES ($1, $2, $3)
                        ON CONFLICT (vendor_id, carrier_id, mode) DO NOTHING
                    `, [vendor.id, carrier.id, mode]);
                }
                console.log(`  Assigned ${selected.length} ${mode} carriers to ${vendor.name}`);
            }
        }
    }
    console.log('Seeding complete.');

  } catch (err) {
    console.error('Seeding error:', err);
  } finally {
    await client.end();
  }
}

seed();
