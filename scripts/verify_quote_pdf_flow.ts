
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gzhxgoigflftharcmdqj.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6aHhnb2lnZmxmdGhhcmNtZHFqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTUxOTY4NywiZXhwIjoyMDg1MDk1Njg3fQ.MImJoQhZUG2lSQ9PpN0z1QwDI1nvA2AsYPOeVfDGMos';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('--- Verifying Quote PDF Flow Data ---');

  try {
    // 1. Get Prerequisites
    const { data: ports } = await supabase.from('ports_locations').select('id, location_name').limit(2);
    const { data: account } = await supabase.from('accounts').select('id').limit(1).maybeSingle();
    const { data: tenant } = await supabase.from('tenants').select('id').limit(1).single();

    if (!ports || ports.length < 2 || !account || !tenant) {
      throw new Error('Missing prerequisites (ports, account, or tenant)');
    }

    // 2. Create Quote
    console.log('Creating Quote...');
    const quotePayload = {
      tenant_id: tenant.id,
      account_id: account.id,
      origin_port_id: ports[0].id,
      destination_port_id: ports[1].id,
      status: 'draft',
      quote_number: `QUO-PDF-${Date.now()}`,
      title: 'PDF Generation Test Quote',
      shipping_amount: 5000,
      currency: 'USD',
      cargo_details: {
          trade_direction: 'export',
          commodity: 'Test Goods',
          total_weight: 1000,
          total_volume: 10
      }
    };

    const { data: quote, error: qError } = await supabase
      .from('quotes')
      .insert(quotePayload)
      .select()
      .single();

    if (qError) throw qError;
    console.log(`Quote Created: ${quote.id} (${quote.quote_number})`);

    // 3. Create Version
    console.log('Creating Version...');
    const { data: version, error: vError } = await supabase
      .from('quotation_versions')
      .insert({
        quote_id: quote.id,
        tenant_id: tenant.id,
        version_number: 1,
        status: 'draft',
        // effective_date: new Date().toISOString(),
        // expiration_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();

    if (vError) throw vError;
    console.log(`Version Created: ${version.id}`);

    // 4. Create Option
    console.log('Creating Option...');
    const { data: option, error: oError } = await supabase
      .from('quotation_version_options')
      .insert({
        quotation_version_id: version.id,
        tenant_id: tenant.id,
        recommended: true,
        // is_primary: true,
        total_amount: 5000,
        currency: 'USD',
        transit_time: '25 days'
      })
      .select()
      .single();

    if (oError) throw oError;
    console.log(`Option Created: ${option.id}`);

    // 5. Verify Data Fetching (Simulation of Edge Function Logic)
    console.log('\n--- Simulating Edge Function Data Fetch ---');
    
    // Fetch Quote with Relations
    const { data: fetchedQuote, error: fqError } = await supabase
      .from("quotes")
      .select(`
        *,
        accounts (name, billing_street, billing_city, billing_state, billing_postal_code, billing_country),
        origin:ports_locations!origin_port_id(location_name, country_id),
        destination:ports_locations!destination_port_id(location_name, country_id)
      `)
      .eq("id", quote.id)
      .single();
    
    if (fqError) throw fqError;
    console.log('Quote Data Fetched:', !!fetchedQuote);
    console.log('- Account Name:', fetchedQuote.accounts?.name);
    console.log('- Origin:', fetchedQuote.origin?.location_name);
    console.log('- Destination:', fetchedQuote.destination?.location_name);

    // Fetch Version Options
    const { data: fetchedOptions, error: foError } = await supabase
      .from("quotation_version_options")
      .select(`
          *,
          carriers(carrier_name),
          legs:quotation_version_option_legs(*)
      `)
      .eq("quotation_version_id", version.id);

    if (foError) throw foError;
    console.log('Options Fetched:', fetchedOptions.length);
    console.log('- Option 1 ID:', fetchedOptions[0]?.id);

    console.log('\nSUCCESS: Data structure is valid for PDF generation.');

  } catch (error) {
    console.error('FAILED:', error);
    process.exit(1);
  }
}

main();
