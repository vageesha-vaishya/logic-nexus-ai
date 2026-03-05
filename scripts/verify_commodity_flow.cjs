
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');
const { isDeepStrictEqual } = require('util');

// Try to load from .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function sanitizePayload(payload) {
  const seen = new WeakSet();
  const sanitize = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (seen.has(obj)) return undefined;
    seen.add(obj);
    if (Array.isArray(obj)) return obj.map(sanitize).filter(v => v !== undefined);
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const sv = sanitize(v);
      if (sv !== undefined) out[k] = sv;
    }
    return out;
  };
  return sanitize(payload);
}

async function verify() {
  console.log('Starting Commodity Flow Verification...');

  // 1. Verify search_hts_codes_smart
  console.log('\n1. Verifying search_hts_codes_smart...');
  const { data: htsData, error: htsError } = await supabase.rpc('search_hts_codes_smart', { 
    p_search_term: 'apple', 
    p_limit: 5 
  });

  if (htsError) {
    console.error('FAIL: search_hts_codes_smart error:', htsError.message);
  } else {
    console.log(`SUCCESS: search_hts_codes_smart returned ${htsData ? htsData.length : 0} results.`);
    if (htsData && htsData.length > 0) {
      console.log('Sample result:', htsData[0]);
    }
  }

  // 2. Verify save_quote_atomic with cargo_details
  console.log('\n2. Verifying save_quote_atomic with cargo_details...');
  
  // Fetch a valid tenant_id
  const { data: tenantData, error: tenantError } = await supabase
    .from('tenants')
    .select('id')
    .limit(1)
    .single();

  if (tenantError) {
    console.error('FAIL: Could not fetch a valid tenant_id:', tenantError.message);
    return;
  }

  const tenantId = tenantData.id;
  console.log('Using Tenant ID:', tenantId);

  const testQuoteId = crypto.randomUUID();
  const testCargoDetails = {
    commodity: 'Test Commodity',
    weight: 1000,
    volume: 10,
    packages: [
      { type: 'box', quantity: 10, dimensions: { l: 10, w: 10, h: 10 } }
    ]
  };

  const payload = {
    quote: {
      id: testQuoteId,
      title: 'Automated Test Quote - Commodity Flow',
      status: 'draft',
      cargo_details: testCargoDetails,
      // Use fetched tenantId
      tenant_id: tenantId,
    },
    items: [],
    cargo_configurations: [],
    options: []
  };

  // Note: tenant_id might be required.
  // Let's try to fetch a valid tenant_id if not in env.
  // But usually RLS handles it.
  
  const { data: saveResult, error: saveError } = await supabase.rpc('save_quote_atomic', { p_payload: sanitizePayload(payload) });

  if (saveError) {
    console.error('FAIL: save_quote_atomic error:', saveError.message);
    // If it fails due to FK, we might need valid IDs.
  } else {
    console.log('SUCCESS: save_quote_atomic executed. Result ID:', saveResult);

    // 3. Verify persistence
    console.log('\n3. Verifying persistence of cargo_details...');
    const { data: quoteData, error: quoteError } = await supabase
      .from('quotes')
      .select('id, cargo_details')
      .eq('id', saveResult)
      .single();

    if (quoteError) {
      console.error('FAIL: Could not fetch saved quote:', quoteError.message);
    } else {
      console.log('Fetched Quote:', quoteData);
      if (isDeepStrictEqual(quoteData.cargo_details, testCargoDetails)) {
        console.log('SUCCESS: cargo_details persisted correctly!');
      } else {
        console.error('FAIL: cargo_details mismatch.');
        console.error('Expected:', testCargoDetails);
        console.error('Actual:', quoteData.cargo_details);
      }
    }
    
    // Cleanup
    console.log('\nCleaning up test quote...');
    await supabase.from('quotes').delete().eq('id', saveResult);
  }
}

verify().catch(console.error);
