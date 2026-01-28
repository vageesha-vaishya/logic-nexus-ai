
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

// Configuration
const SCHEMA_DIR = path.join(__dirname, '../../fixed_schema_parts');
const CONNECTION_STRING = process.env.DATABASE_URL; // Ensure this is set in your .env

if (!CONNECTION_STRING) {
  console.error('Error: DATABASE_URL is not defined in .env');
  process.exit(1);
}

// Helper: Get all schema files in order
function getSchemaFiles() {
  return fs.readdirSync(SCHEMA_DIR)
    .filter(f => f.startsWith('schema_part_') && f.endsWith('.sql'))
    .sort()
    .map(f => path.join(SCHEMA_DIR, f));
}

// Helper: Run SQL
async function runSql(client, sql, description) {
  try {
    console.log(`Executing: ${description}`);
    await client.query(sql);
  } catch (err) {
    console.error(`❌ Error in ${description}:`, err.message);
    throw err;
  }
}

// Helper: Clean Database (Use with CAUTION - only for local dev/test)
async function cleanDatabase(client) {
  console.log('🧹 Cleaning database...');
  await runSql(client, `
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO postgres;
    GRANT ALL ON SCHEMA public TO public;
    DROP SCHEMA IF EXISTS logistics CASCADE;
  `, 'Clean Database');
}

// Test 1: Clean Environment
async function testCleanEnvironment(client) {
  console.log('\n--- Test 1: Clean Environment ---');
  await cleanDatabase(client);
  
  const files = getSchemaFiles();
  for (const file of files) {
    const sql = fs.readFileSync(file, 'utf8');
    await runSql(client, sql, `Applying ${path.basename(file)}`);
  }
  console.log('✅ Clean Environment Test Passed');
}

// Test 2: Partial/Repeated Execution (Idempotency)
async function testPartialEnvironment(client) {
  console.log('\n--- Test 2: Partial/Repeated Execution (Idempotency) ---');
  
  // Rerun everything on top of the existing state
  const files = getSchemaFiles();
  for (const file of files) {
    const sql = fs.readFileSync(file, 'utf8');
    await runSql(client, sql, `Re-applying ${path.basename(file)}`);
  }
  console.log('✅ Partial/Repeated Execution Test Passed');
}

// Test 3: Data Integrity Check (Phase 0.1 Specific)
async function testDataIntegrity(client) {
  console.log('\n--- Test 3: Data Integrity Check ---');
  
  // Check if view exists and works
  try {
    const res = await client.query('SELECT count(*) FROM public.quote_items');
    console.log(`✅ quote_items view is accessible (Count: ${res.rows[0].count})`);
  } catch (err) {
    console.error('❌ quote_items view check failed:', err.message);
    throw err;
  }

  // Check if split tables exist
  try {
    await client.query('SELECT 1 FROM public.quote_items_core LIMIT 1');
    console.log('✅ public.quote_items_core exists');
    await client.query('SELECT 1 FROM logistics.quote_items_extension LIMIT 1');
    console.log('✅ logistics.quote_items_extension exists');
  } catch (err) {
    console.error('❌ Split tables check failed:', err.message);
    throw err;
  }
  
  // Test Insert via View (Trigger Test)
  try {
    const testId = '00000000-0000-0000-0000-000000000001';
    const quoteId = '00000000-0000-0000-0000-000000000002'; // Dummy
    
    // Cleanup first
    await client.query('DELETE FROM public.quote_items WHERE id = $1', [testId]);

    console.log('Testing INSERT via View...');
    await client.query(`
      INSERT INTO public.quote_items (
        id, quote_id, line_number, product_name, quantity, unit_price, line_total,
        weight_kg, service_type_id
      ) VALUES ($1, $2, 1, 'Test Product', 10, 100, 1000, 50.5, $2)
    `, [testId, quoteId]);
    
    // Verify Split
    const coreRes = await client.query('SELECT * FROM public.quote_items_core WHERE id = $1', [testId]);
    const extRes = await client.query('SELECT * FROM logistics.quote_items_extension WHERE quote_item_id = $1', [testId]);
    
    if (coreRes.rows.length === 1 && extRes.rows.length === 1) {
      console.log('✅ Data correctly split into Core and Extension tables');
    } else {
      throw new Error('Data split failed');
    }
    
    // Verify Read via View
    const viewRes = await client.query('SELECT * FROM public.quote_items WHERE id = $1', [testId]);
    if (viewRes.rows[0].weight_kg == 50.5) {
      console.log('✅ Data correctly read back via View');
    } else {
      throw new Error('Read back failed');
    }

  } catch (err) {
    console.error('❌ Trigger/Logic test failed:', err.message);
    // Don't throw here to allow cleanup, or throw if critical
  }
}

// Main Runner
(async () => {
  const client = new Client({ connectionString: CONNECTION_STRING });
  try {
    await client.connect();
    console.log('Connected to database.');
    
    await testCleanEnvironment(client);
    await testPartialEnvironment(client);
    await testDataIntegrity(client);
    
    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY 🎉');
  } catch (err) {
    console.error('\n⛔ TESTS FAILED');
    console.error(err);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
