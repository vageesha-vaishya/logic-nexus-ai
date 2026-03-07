const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env');
  process.exit(1);
}

const client = createClient(supabaseUrl, supabaseServiceKey);

async function inspect() {
  const quoteId = '38f327ac-ba09-4502-aacb-5ac2536c2a12'; // QUO-260202-00005

  console.log(`Inspecting Quote: ${quoteId}`);

  // 1. Fetch Quote
  const { data: quote, error: quoteError } = await client
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .single();

  if (quoteError) {
    console.error('Error fetching quote:', quoteError);
  } else {
    console.log('Quote Data (Main):');
    console.log(`- expiration_date: ${quote.expiration_date}`);
    console.log(`- valid_until: ${quote.valid_until}`);
    console.log(`- validity_date: ${quote.validity_date}`);
    console.log(`- cargo_details:`, JSON.stringify(quote.cargo_details || 'null'));
  }

  // 2. Fetch All Versions
  const { data: versions, error: vError } = await client
    .from('quotation_versions')
    .select('*')
    .eq('quote_id', quoteId)
    .order('created_at', { ascending: false });

  if (vError) {
    console.error('Error fetching versions:', vError);
  } else {
    console.log(`\nFound ${versions.length} versions.`);
    versions.forEach((v, i) => {
      console.log(`\nVersion ${i + 1} (ID: ${v.id}, Status: ${v.status}, Created: ${v.created_at}):`);
      console.log(`- valid_until: ${v.valid_until}`);
      console.log(`- expiration_date: ${v.expiration_date}`);
      
      const snap = v.snapshot || {};
      console.log(`- Snapshot Keys: ${Object.keys(snap).join(', ')}`);
      console.log(`- Snapshot.items length: ${Array.isArray(snap.items) ? snap.items.length : 'N/A'}`);
      if (Array.isArray(snap.items) && snap.items.length > 0) {
        console.log(`- First Item:`, JSON.stringify(snap.items[0]));
      }
      console.log(`- Snapshot.expiration_date: ${snap.expiration_date}`);
      console.log(`- Snapshot.valid_until: ${snap.valid_until}`);
      console.log(`- Snapshot.validity_date: ${snap.validity_date}`);
    });
  }

  // 3. Fetch Quote Items (Direct Table)
  const { data: items, error: iError } = await client
    .from('quote_items')
    .select('*')
    .eq('quote_id', quoteId);

  if (iError) {
    console.error('Error fetching quote_items:', iError.message); // Log message specifically
  } else {
    console.log(`\nquote_items table count: ${items.length}`);
    if (items.length > 0) {
        console.log('First quote_item:', JSON.stringify(items[0]));
    }
  }

  // 3b. Fetch Quote Items Core (Fallback Table)
  const { data: itemsCore, error: icError } = await client
    .from('quote_items_core')
    .select('*')
    .eq('quote_id', quoteId);

  if (icError) {
    console.error('Error fetching quote_items_core:', icError.message);
  } else {
    console.log(`\nquote_items_core table count: ${itemsCore.length}`);
    if (itemsCore.length > 0) {
        console.log('First quote_item_core:', JSON.stringify(itemsCore[0]));
    }
  }

  // 4. Check for other potentially related tables
  const { data: commodities, error: cError } = await client
    .from('quote_commodities')
    .select('*')
    .eq('quote_id', quoteId);
    
  if (cError) {
      // console.error('quote_commodities check failed:', cError.message);
  } else {
      console.log(`\nquote_commodities table count: ${commodities.length}`);
  }

}

inspect();
