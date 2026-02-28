
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env and .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('DATABASE_URL is not defined in .env.local');
  process.exit(1);
}

async function diagnoseQuoteLoading() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    // 1. List recent quotes
    console.log('\n--- Recent Quotes ---');
    const recentQuotes = await client.query(`
      SELECT id, quote_number, title, tenant_id, owner_id, created_at
      FROM quotes
      ORDER BY created_at DESC
      LIMIT 5;
    `);
    console.table(recentQuotes.rows);

    if (recentQuotes.rows.length === 0) {
      console.log('No quotes found.');
      return;
    }

    const targetQuote = recentQuotes.rows[0];
    const quoteId = targetQuote.id;
    console.log(`\n--- Diagnosing Quote: ${targetQuote.quote_number} (${quoteId}) ---`);

    // 2. Simulate UnifiedQuoteComposer query (Converted to standard SQL)
  console.log('Checking Quote Data (UnifiedQuoteComposer query simulation)...');
  const quoteQuery = await client.query(`
    SELECT quotes.*, 
           origin.location_name as origin_name, origin.location_code as origin_code,
           dest.location_name as dest_name, dest.location_code as dest_code
    FROM quotes
    LEFT JOIN ports_locations AS origin ON quotes.origin_port_id = origin.id
    LEFT JOIN ports_locations AS dest ON quotes.destination_port_id = dest.id
    WHERE quotes.id = $1
  `, [quoteId]);
    
    if (quoteQuery.rows.length === 0) {
        console.error('FAILED: Quote not found with simulated query.');
    } else {
        console.log('SUCCESS: Quote found.');
        const q = quoteQuery.rows[0];
        console.log('Quote Data Summary:', {
            id: q.id,
            tenant_id: q.tenant_id,
            owner_id: q.owner_id,
            origin: q.origin, // Fallback text field
            destination: q.destination, // Fallback text field
            origin_port_id: q.origin_port_id,
            destination_port_id: q.destination_port_id,
            origin_resolved: q.origin_name,
            dest_resolved: q.dest_name,
            cargo_details: q.cargo_details
        });
    }

    // 3. Check Versions
    console.log('\n--- Checking Versions ---');
    const versions = await client.query(`
      SELECT id, version_number, major, minor, kind, status, is_active
      FROM quotation_versions
      WHERE quote_id = $1
      ORDER BY version_number DESC
    `, [quoteId]);
    console.table(versions.rows);

    let versionId = null;
    if (versions.rows.length > 0) {
        versionId = versions.rows[0].id;
        console.log(`Using latest version ID: ${versionId}`);
    } else {
        console.warn('WARNING: No versions found for this quote.');
    }

    // 4. Check Options
    if (versionId) {
        console.log(`\n--- Checking Options for Version ${versionId} ---`);
        const options = await client.query(`
            SELECT id, is_selected, total_amount, currency, status, created_at
            FROM quotation_version_options
            WHERE quotation_version_id = $1
            ORDER BY created_at DESC
        `, [versionId]);
        console.table(options.rows);
    }

    // 5. Check RLS policies (simulated check)
    console.log('\n--- RLS Policy Check (Simulated) ---');
    console.log('Quote Owner ID:', targetQuote.owner_id);
    console.log('Quote Tenant ID:', targetQuote.tenant_id);
    // We can't easily simulate RLS context here without switching roles, but we can verify the data fields required for RLS.
    if (!targetQuote.owner_id) {
        console.error('CRITICAL: Quote has NO owner_id. This will likely fail RLS checks for non-admin users.');
    } else {
        console.log('OK: Quote has owner_id.');
    }
    if (!targetQuote.tenant_id) {
        console.error('CRITICAL: Quote has NO tenant_id.');
    } else {
        console.log('OK: Quote has tenant_id.');
    }


  } catch (error) {
    console.error('Error during diagnosis:', error);
  } finally {
    await client.end();
  }
}

diagnoseQuoteLoading();
