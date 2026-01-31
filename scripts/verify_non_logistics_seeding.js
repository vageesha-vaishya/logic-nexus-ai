import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

const { Client } = pg;

async function verifySeeding() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    // 1. Check Service Categories
    const resCategories = await client.query(`
      SELECT code, name FROM service_categories 
      WHERE code IN ('trading', 'insurance', 'customs')
    `);
    console.log('\n--- Service Categories ---');
    console.table(resCategories.rows);
    if (resCategories.rows.length !== 3) {
      console.error(`❌ Expected 3 categories, found ${resCategories.rows.length}`);
    } else {
      console.log('✅ All non-logistics categories present.');
    }

    // 2. Check Service Types
    const resTypes = await client.query(`
      SELECT st.code, st.name, sc.code as category 
      FROM service_types st
      JOIN service_categories sc ON st.category_id = sc.id
      WHERE st.code IN ('procurement_agent', 'quality_inspection', 'cargo_insurance', 'import_clearance')
    `);
    console.log('\n--- Service Types ---');
    console.table(resTypes.rows);
    if (resTypes.rows.length !== 4) {
      console.error(`❌ Expected 4 service types, found ${resTypes.rows.length}`);
    } else {
      console.log('✅ All non-logistics service types present.');
    }

    // 3. Check Attribute Definitions
    const resAttributes = await client.query(`
      SELECT st.code as service_type, sad.attribute_key, sad.label, sad.data_type
      FROM service_attribute_definitions sad
      JOIN service_types st ON sad.service_type_id = st.id
      WHERE st.code IN ('procurement_agent', 'quality_inspection', 'cargo_insurance', 'import_clearance')
      ORDER BY st.code, sad.display_order
    `);
    console.log('\n--- Attribute Definitions ---');
    console.table(resAttributes.rows);
    if (resAttributes.rows.length > 0) {
      console.log(`✅ Found ${resAttributes.rows.length} attribute definitions.`);
    } else {
      console.error('❌ No attribute definitions found!');
    }

    // 4. Check Sample Services (if tenant exists)
    const resServices = await client.query(`
      SELECT s.service_code, s.service_name, sd.attributes
      FROM services s
      LEFT JOIN service_details sd ON s.id = sd.service_id
      WHERE s.service_code IN ('TRD-PROC-ELEC')
    `);
    console.log('\n--- Sample Services ---');
    if (resServices.rows.length > 0) {
      console.table(resServices.rows);
      console.log('✅ Sample service found.');
    } else {
      console.log('ℹ️ Sample service not found (Tenant might not exist, which is expected in some envs).');
    }

  } catch (err) {
    console.error('Error verifying seeding:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifySeeding();
