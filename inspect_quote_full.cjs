const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Missing DATABASE_URL in .env');
  process.exit(1);
}

async function inspectQuote() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to DB');

    // 1. Get Quote
    const quoteRes = await client.query(`
      SELECT * FROM quotes WHERE quote_number = 'QUO-260303-00002'
    `);
    
    if (quoteRes.rows.length === 0) {
      console.log('Quote not found!');
      return;
    }
    
    const quote = quoteRes.rows[0];
    console.log('Quote Keys:', Object.keys(quote));
    console.log('Template ID:', quote.template_id);
        console.log('Contact ID:', quote.contact_id);
        console.log('Account ID:', quote.account_id);

        // Fetch Contact details
        if (quote.contact_id) {
            const contactRes = await client.query("SELECT * FROM contacts WHERE id = $1", [quote.contact_id]);
            if (contactRes.rows.length > 0) {
                console.log('Contact Data:', contactRes.rows[0]);
            } else {
                console.log('Contact ID found in quote but NO record in contacts table!');
            }
        } else {
            console.log('No Contact ID in quote.');
        }

        // Fetch Account details
        if (quote.account_id) {
             const accountRes = await client.query("SELECT * FROM accounts WHERE id = $1", [quote.account_id]);
             if (accountRes.rows.length > 0) {
                 console.log('Account Data:', accountRes.rows[0]);
             } else {
                 console.log('Account ID found in quote but NO record in accounts table!');
             }
        } else {
             console.log('No Account ID in quote.');
        }
    // console.log('Quote Full:', JSON.stringify(quote, null, 2));
    const quoteId = quote.id;

    // Check for account_id or other potential customer links
    let accountId = quote.account_id;
    if (accountId) {
         console.log('Found account_id:', accountId);
         try {
            const accRes = await client.query('SELECT * FROM accounts WHERE id = $1', [accountId]);
            if (accRes.rows.length > 0) {
                console.log('Account Data:', JSON.stringify(accRes.rows[0], null, 2));
            } else {
                console.log('Account ID found but no record in accounts table');
            }
         } catch (e) {
             console.log('Error fetching account:', e.message);
         }
    } else {
         console.log('No account_id');
    }
    if (quote.opportunity_id) {
         console.log('Found opportunity_id:', quote.opportunity_id);
    } else {
          console.log('No opportunity_id');
     }
     
     // Check Charges
     try {
         const chargesRes = await client.query('SELECT * FROM quote_charges WHERE quote_option_id IS NOT NULL LIMIT 1'); 
         console.log(`Probe Quote Charges: Found ${chargesRes.rows.length} (checking if table works)`);
     } catch (e) {
         console.log('Skipping direct quote_charges check due to error');
     }

     const versionRes = await client.query(`
        SELECT * FROM quotation_versions 
        WHERE quote_id = $1 
        ORDER BY version_number DESC 
        LIMIT 1
    `, [quoteId]);

    if (versionRes.rows.length === 0) { console.log('Version not found!'); return; }
    const version = versionRes.rows[0];
    const versionId = version.id;
    // console.log('Version:', JSON.stringify(version, null, 2));

    const optionsRes = await client.query(`
        SELECT * FROM quotation_version_options WHERE quotation_version_id = $1
    `, [versionId]);
    console.log(`Options count: ${optionsRes.rows.length}`);
    // console.log('Options:', JSON.stringify(optionsRes.rows, null, 2));

    // For each option, get legs and charges
    for (const opt of optionsRes.rows) {
        const legsRes = await client.query(`
            SELECT * FROM quotation_version_option_legs WHERE quotation_version_option_id = $1 ORDER BY sort_order
        `, [opt.id]);
        console.log(`Option ${opt.id} Legs: ${legsRes.rows.length}`);
        
        const optChargesRes = await client.query(`
            SELECT * FROM quote_charges WHERE quote_option_id = $1
        `, [opt.id]);
        console.log(`Option ${opt.id} Charges: ${optChargesRes.rows.length}`);
        if (optChargesRes.rows.length > 0) {
            console.log('Sample Charge:', JSON.stringify(optChargesRes.rows[0], null, 2));
        }
    }

    // 6. Check for Customer Info in a separate table if needed (e.g., customers, organizations)
    // The quote has 'customer_id' or similar?
    // quote.customer_id
    if (quote.customer_id) {
        // Try 'customers' or 'accounts' table?
        // Usually 'customers' or 'profiles' or 'organizations'
        // Let's guess 'customers' first
        try {
            const custRes = await client.query(`SELECT * FROM customers WHERE id = $1`, [quote.customer_id]);
             console.log('Customer:', JSON.stringify(custRes.rows[0], null, 2));
        } catch (e) {
             console.log('Could not fetch customer from customers table');
        }
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

inspectQuote();
