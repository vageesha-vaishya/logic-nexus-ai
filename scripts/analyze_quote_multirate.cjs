
const { Client } = require('pg');
require('dotenv').config();

// Use the working connection details from diagnose-db-access.cjs
// Host: aws-1-ap-south-1.pooler.supabase.com
// Port: 6543
// User: postgres.gzhxgoigflftharcmdqj
// Password: #!January#2026! (from diagnose script logic, or env)

// I will try to use process.env.DATABASE_URL first, as diagnose script said it worked.
// If not, I'll fallback to constructing it.

const connectionString = process.env.DATABASE_URL || "postgres://postgres.gzhxgoigflftharcmdqj:#!January#2026!@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    await client.connect();
    console.log('Connected to DB');

    const quoteNum = 'QUO-260303-00002';
    console.log(`Searching for quote: ${quoteNum}`);

    const quoteRes = await client.query(`
      SELECT id, quote_number, status, current_version_id 
      FROM quotes 
      WHERE quote_number = $1
    `, [quoteNum]);

    if (quoteRes.rows.length === 0) {
      console.log('❌ Quote not found!');
      return;
    }

    const quote = quoteRes.rows[0];
    console.log('✅ Quote found:', quote);

    // Get options for the current version
    if (!quote.current_version_id) {
        console.log('❌ No current_version_id on quote!');
        // Try to find latest version
        const verRes = await client.query(`
            SELECT id FROM quotation_versions WHERE quote_id = $1 ORDER BY created_at DESC LIMIT 1
        `, [quote.id]);
        if (verRes.rows.length > 0) {
            quote.current_version_id = verRes.rows[0].id;
            console.log('Found latest version:', quote.current_version_id);
        } else {
            console.log('❌ No versions found for quote!');
            return;
        }
    }

    // Check columns
    const colsRes = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'quotation_version_options'`);
    console.log('Options Cols:', colsRes.rows.map(r => r.column_name).join(', '));
    const legsColsRes = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'quotation_version_option_legs'`);
    console.log('Legs Cols:', legsColsRes.rows.map(r => r.column_name).join(', '));

    // Get Options
    const optionsRes = await client.query(`
            SELECT 
                id, 
                carrier_id,
                carrier_name, 
                service_type, 
                total_amount, 
                total_sell, 
                total_buy 
            FROM quotation_version_options 
            WHERE quotation_version_id = $1
        `, [quote.current_version_id]);

        console.log(`Found ${optionsRes.rowCount} options for Version ID: ${quote.current_version_id}`);

        for (const opt of optionsRes.rows) {
            console.log(`Option ID: ${opt.id}`);
            console.log(`  Carrier ID: ${opt.carrier_id}`);
            console.log(`  Carrier Name: ${opt.carrier_name}, Service Type: ${opt.service_type}`);
        console.log(`  Totals: Amount=${opt.total_amount}, Sell=${opt.total_sell}, Buy=${opt.total_buy}`);
        
        // Check Charges
    const chargesRes = await client.query(`SELECT * FROM quote_charges WHERE quote_option_id = $1`, [opt.id]);
    console.log(`  Charges Count: ${chargesRes.rowCount}`);
    chargesRes.rows.forEach((c, i) => {
        console.log(`    Charge ${i+1}: Amount=${c.amount}, Currency=${c.currency}`);
    });
    
    // Check Legs
    const legsRes = await client.query(`SELECT * FROM quotation_version_option_legs WHERE quotation_version_option_id = $1`, [opt.id]);
        console.log(`  Legs Count: ${legsRes.rowCount}`);
        legsRes.rows.forEach((leg, i) => {
             console.log(`    Leg ${i+1}: Mode=${leg.mode}, TransMode=${leg.transport_mode}, Carrier=${leg.carrier_name}, Transit=${leg.transit_time}, Amount=${leg.total_amount}, ProviderID=${leg.provider_id}`);
        });
    }

    if (optionsRes.rows.length < 2) {
        console.log('⚠️ Less than 2 options found. User asked for multi-rate analysis.');
    } else {
        console.log('✅ Multi-rate data verified.');
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
