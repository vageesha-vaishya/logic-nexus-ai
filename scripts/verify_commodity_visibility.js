import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Use service role key if available for bypassing RLS, otherwise anon key
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyCommodityVisibility() {
  console.log('🔍 Verifying Commodity & HTS Code Visibility...');

  try {
    // 1. Get Tenant
    const { data: tenants } = await supabase.from('tenants').select('id').limit(1);
    if (!tenants || tenants.length === 0) throw new Error('No tenants found');
    const tenantId = tenants[0].id;
    console.log(`✅ Using Tenant ID: ${tenantId}`);

    // 2. Get Reference Data (Commodity & HTS)
    const { data: commodities } = await supabase.from('master_commodities').select('id, name').limit(1);
    const { data: htsCodes } = await supabase.from('aes_hts_codes').select('id, hts_code').limit(1);

    const commodityId = commodities?.[0]?.id || null;
    const aesHtsId = htsCodes?.[0]?.id || null;

    if (!commodityId && !aesHtsId) {
        console.warn('⚠️ No commodity or HTS code found. Test might be partial.');
    }
    console.log(`Using Commodity ID: ${commodityId}, AES HTS ID: ${aesHtsId}`);

    // 3. Create Test Quote Header
    const quoteTitle = `TEST-COMMODITY-${Date.now()}`;
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .insert({
        tenant_id: tenantId,
        title: quoteTitle,
        status: 'draft'
      })
      .select('id')
      .single();

    if (quoteError) throw new Error(`Failed to create quote: ${quoteError.message}`);
    const quoteId = quote.id;
    console.log(`✅ Created Test Quote: ${quoteId}`);

    // 4. Insert Quote Item with Commodity/HTS fields via View
    // Simulating useQuoteRepository logic
    const itemPayload = {
        quote_id: quoteId,
        line_number: 1,
        product_name: 'Test Product',
        commodity_id: commodityId,
        aes_hts_id: aesHtsId,
        description: 'Test Commodity Description - Dual Visibility',
        quantity: 100,
        unit_price: 10.5,
        attributes: {
            test_attr: 'value'
        }
    };

    console.log('Inserting item payload:', itemPayload);

    const { error: itemError } = await supabase
        .from('quote_items')
        .insert(itemPayload);

    if (itemError) throw new Error(`Failed to insert quote item: ${itemError.message}`);
    console.log('✅ Inserted Quote Item via View');

    // 5. Verify Data Persistence via View
    const { data: fetchedItems, error: fetchError } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', quoteId);

    if (fetchError) throw new Error(`Failed to fetch items: ${fetchError.message}`);
    
    if (fetchedItems.length === 0) throw new Error('No items found after insertion');

    const item = fetchedItems[0];
    console.log('Fetched Item:', item);

    let success = true;

    // Check Description
    if (item.description === 'Test Commodity Description - Dual Visibility') {
        console.log('✅ Description persisted correctly');
    } else {
        console.error(`❌ Description mismatch: Expected "Test Commodity Description - Dual Visibility", got "${item.description}"`);
        success = false;
    }

    // Check Commodity ID
    if (item.commodity_id === commodityId) {
        console.log('✅ Commodity ID persisted correctly');
    } else {
        console.error(`❌ Commodity ID mismatch: Expected ${commodityId}, got ${item.commodity_id}`);
        success = false;
    }

    // Check AES HTS ID
    if (item.aes_hts_id === aesHtsId) {
        console.log('✅ AES HTS ID persisted correctly');
    } else {
        console.error(`❌ AES HTS ID mismatch: Expected ${aesHtsId}, got ${item.aes_hts_id}`);
        success = false;
    }

    // 6. Cleanup
    console.log('🧹 Cleaning up...');
    await supabase.from('quote_items').delete().eq('quote_id', quoteId); // Should cascade or trigger delete
    await supabase.from('quotes').delete().eq('id', quoteId);

    if (success) {
        console.log('🎉 VERIFICATION SUCCESSFUL: Dual visibility fields are working correctly.');
    } else {
        console.error('❌ VERIFICATION FAILED');
        process.exit(1);
    }

  } catch (err) {
    console.error('❌ Unexpected Error:', err);
    process.exit(1);
  }
}

verifyCommodityVisibility();
