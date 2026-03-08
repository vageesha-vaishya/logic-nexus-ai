
const pg = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to DB');

    // 1. Check Quote
    const quoteRes = await client.query(`
      SELECT id, quote_number, template_id, status 
      FROM quotes 
      WHERE quote_number = 'QUO-MGL-MATRIX-TEST'
    `);
    
    if (quoteRes.rows.length === 0) {
      console.log('Quote QUO-MGL-MATRIX-TEST not found');
      return;
    }

    const quote = quoteRes.rows[0];
    console.log('Quote found:', quote);

    // 2. Check Versions
    const versionRes = await client.query(`
      SELECT id, version_number 
      FROM quotation_versions 
      WHERE quote_id = $1
    `, [quote.id]);

    if (versionRes.rows.length === 0) {
      console.log('No versions found for quote');
      return;
    }

    const version = versionRes.rows[0];
    console.log('Version found:', version);

    // 3. Check Options
    const optionsRes = await client.query(`
      SELECT id, carrier_id, total_amount, transit_time 
      FROM quotation_version_options 
      WHERE quotation_version_id = $1
    `, [version.id]);

    console.log(`Found ${optionsRes.rows.length} options`);
    optionsRes.rows.forEach((opt, i) => {
      console.log(`Option ${i+1}: Carrier=${opt.carrier_id}, Total=${opt.total_amount}`);
    });
    
    // 8. Check Quotes Schema
    const quotesSchemaRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'quotes'
      ORDER BY ordinal_position;
    `);
    console.log('Columns in quotes:', quotesSchemaRes.rows.map(r => r.column_name));

    // 9. Check Container Schemas
    const ctSchema = await client.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'container_types' ORDER BY ordinal_position;
    `);
    console.log('Columns in container_types:', ctSchema.rows.map(r => r.column_name));

    // 12. Check Triggers on quote_items_legacy
    const triggersRes = await client.query(`
      SELECT trigger_name, event_manipulation, action_statement, action_timing
      FROM information_schema.triggers
      WHERE event_object_table = 'quote_items_legacy'
    `);
    console.log('Triggers on quote_items_legacy:', triggersRes.rows);

    const triggersCoreRes = await client.query(`
        SELECT trigger_name, event_manipulation, action_statement, action_timing
        FROM information_schema.triggers
        WHERE event_object_table = 'quote_items_core'
      `);
      console.log('Triggers on quote_items_core:', triggersCoreRes.rows);

    // 13. Get Function Definition
    const funcRes = await client.query(`
      SELECT pg_get_functiondef('recalculate_and_sync_quote_trigger'::regproc) as func_def;
    `);
    console.log('Function Definition:', funcRes.rows[0].func_def);

    // 14. Get sync_opportunity_items_from_quote Definition
    const syncFuncRes = await client.query(`
      SELECT pg_get_functiondef('sync_opportunity_items_from_quote'::regproc) as func_def;
    `);
    console.log('Sync Function Definition:', syncFuncRes.rows[0].func_def);

    // 15. Check Columns of quote_items_legacy
    const legacyCols = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'quote_items_legacy'
    `);
    console.log('Columns in quote_items_legacy:', legacyCols.rows.map(r => r.column_name));

    // 16. Verify Quote Items (Legacy)
    const itemsRes = await client.query(`
      SELECT id, line_number, product_name, quantity, weight_kg, volume_cbm
      FROM quote_items_legacy
      WHERE quote_id = $1
    `, [quote.id]);
    console.log(`Found ${itemsRes.rowCount} quote items (legacy):`);
    itemsRes.rows.forEach(item => {
      console.log(`Item ${item.line_number}: ${item.product_name}, Qty=${item.quantity}, W=${item.weight_kg}, V=${item.volume_cbm}`);
    });
    
    /*
    const itemsRes = await client.query(`
      SELECT id, quantity, weight_kg, volume_cbm 
      FROM quote_items_legacy 
      WHERE quote_id = $1
    `, [quote.id]);
    */

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
