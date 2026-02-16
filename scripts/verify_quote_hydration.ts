import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyQuoteHydration() {
  console.log('Verifying Quote Hydration Data Flow...');

  // 1. Create a dummy quote using the RPC (simulating save)
  // We need to fetch valid IDs for foreign keys first
  
  // Resolve a tenant for scoped inserts
  const { data: tenantRow, error: tenantError } = await supabase
    .from('tenants')
    .select('id')
    .limit(1)
    .single();
  if (tenantError || !tenantRow) {
    console.error('Failed to resolve tenant:', tenantError?.message);
    return;
  }
  const tenantId = tenantRow.id;
  console.log('Resolved tenant:', tenantId);
  
  // Get a tenant (if multi-tenant) or just use null if allowed, but usually required.
  // We'll try to get one from existing quotes or just use a dummy UUID if RLS allows (service role).
  
  // Get a valid incoterm_id
  const { data: incoterms, error: incotermError } = await supabase.from('incoterms').select('*').limit(1);
  if (incotermError) console.error('Error fetching incoterms:', incotermError);
  else console.log('Fetched incoterms:', incoterms);
  let incotermId = incoterms?.[0]?.id;
  let incotermCode = incoterms?.[0]?.incoterm_code || incoterms?.[0]?.code; // try both
  if (!incotermId) {
    console.log('No incoterms found. Seeding default incoterm FOB...');
    const { data: seeded, error: seedError } = await supabase
      .from('incoterms')
      .insert({ incoterm_code: 'FOB', incoterm_name: 'Free On Board', tenant_id: tenantId })
      .select('*')
      .limit(1);
    if (seedError) {
      console.error('Failed to seed incoterm:', seedError);
      return;
    }
    incotermId = seeded?.[0]?.id;
    incotermCode = seeded?.[0]?.incoterm_code || 'FOB';
    console.log(`Seeded incoterm: ${incotermCode} (${incotermId})`);
  }
  
  // Get a valid currency_id
  const { data: currencies, error: currencyError } = await supabase.from('currencies').select('*').limit(1);
  if (currencyError) console.error('Error fetching currencies:', currencyError);
  else console.log('Fetched currencies:', currencies);

  const currencyId = currencies?.[0]?.id;
  
  if (!incotermId || !currencyId) {
    console.error('Could not find incoterms or currencies to test with.');
    return;
  }
  
  console.log(`Using Incoterm: ${incotermCode} (${incotermId})`);
  console.log(`Using Currency: ${currencies[0].code} (${currencyId})`);

  const testQuoteId = crypto.randomUUID();
  const payload = {
    quote: {
      id: testQuoteId,
      title: 'Hydration Verification Test Quote',
      incoterms: incotermCode,
      incoterm_id: incotermId,
      currency_id: currencyId,
      tenant_id: tenantId,
      status: 'draft'
    },
    items: [],
    cargo_configurations: [],
    options: []
  };

  console.log('Saving quote via save_quote_atomic...');
  const { data: saveResult, error: saveError } = await supabase.rpc('save_quote_atomic', { p_payload: payload });

  if (saveError) {
    console.error('Error saving quote:', saveError);
    return;
  }
  
  console.log('Quote saved successfully:', saveResult);

  // 2. Fetch the quote back (simulating hydration)
  console.log('Fetching quote back...');
  const { data: quote, error: fetchError } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', testQuoteId)
    .single();

  if (fetchError) {
    console.error('Error fetching quote:', fetchError);
    return;
  }

  // 3. Verify fields
  console.log('Verifying fields...');
  let passed = true;

  if (quote.incoterm_id === incotermId) {
    console.log('✅ incoterm_id matches');
  } else {
    console.error(`❌ incoterm_id mismatch: expected ${incotermId}, got ${quote.incoterm_id}`);
    passed = false;
  }

  if (quote.currency_id === currencyId) {
    console.log('✅ currency_id matches');
  } else {
    console.error(`❌ currency_id mismatch: expected ${currencyId}, got ${quote.currency_id}`);
    passed = false;
  }
  
  // Cleanup
  console.log('Cleaning up...');
  await supabase.from('quotes').delete().eq('id', testQuoteId);
  
  if (passed) {
    console.log('🎉 Verification Successful! Data persistence is working.');
  } else {
    console.error('⛔ Verification Failed.');
    process.exit(1);
  }
}

verifyQuoteHydration();
