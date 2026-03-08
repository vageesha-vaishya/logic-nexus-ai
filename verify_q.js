
const pg = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

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
      SELECT id, version_number, total_amount 
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
      SELECT id, carrier_id, grand_total, transit_time 
      FROM quotation_version_options 
      WHERE quotation_version_id = $1
    `, [version.id]);

    console.log(`Found ${optionsRes.rows.length} options`);
    optionsRes.rows.forEach((opt, i) => {
      console.log(`Option ${i+1}: Carrier=${opt.carrier_id}, Total=${opt.grand_total}`);
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
