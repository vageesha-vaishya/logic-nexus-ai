import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase URL or Service Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runRegressionTest() {
  console.log('Starting Regression Test for Quote Flow...');

  const tenantId = 'fbb1e554-6cf5-4091-b351-962db415efb2'; // Using the tenant from the issue
  const testQuoteId = `test-quote-${Date.now()}`;
  
  try {
    // 1. Create a Quote
    console.log('\n1. Creating Test Quote...');
    const { data: quote, error: createError } = await supabase
      .from('quotes')
      .insert({
        tenant_id: tenantId,
        title: 'Regression Test Quote',
        status: 'draft',
        service_id: null, // Optional
        quote_number: `REG-${Date.now()}`
      })
      .select()
      .single();

    if (createError) throw new Error(`Failed to create quote: ${createError.message}`);
    console.log('Quote Created:', quote.id);

    // 2. Add Items
    console.log('\n2. Adding Items...');
    const { error: itemsError } = await supabase
      .from('quote_items')
      .insert([
        {
          quote_id: quote.id,
          line_number: 1,
          product_name: 'Test Item 1',
          quantity: 10,
          unit_price: 50,
          line_total: 500,
          tenant_id: tenantId
        },
        {
            quote_id: quote.id,
            line_number: 2,
            product_name: 'Test Item 2',
            quantity: 5,
            unit_price: 100,
            line_total: 500,
            tenant_id: tenantId
        }
      ]);

    if (itemsError) throw new Error(`Failed to add items: ${itemsError.message}`);
    console.log('Items Added');

    // 3. Simulate Fetch (Edit Mode) - Parallel Fetch like the hook
    console.log('\n3. Simulating Fetch (Edit Mode)...');
    const [fetchedQuote, fetchedItems, fetchedCargo] = await Promise.all([
      supabase.from('quotes').select('*').eq('id', quote.id).single(),
      supabase.from('quote_items').select('*').eq('quote_id', quote.id).order('line_number'),
      supabase.from('quote_cargo_configurations').select('*').eq('quote_id', quote.id)
    ]);

    if (fetchedQuote.error) throw new Error(`Fetch Quote Failed: ${fetchedQuote.error.message}`);
    if (fetchedItems.error) throw new Error(`Fetch Items Failed: ${fetchedItems.error.message}`);
    if (fetchedCargo.error) throw new Error(`Fetch Cargo Failed: ${fetchedCargo.error.message}`);

    console.log(`Fetched Quote: ${fetchedQuote.data.title}`);
    console.log(`Fetched Items: ${fetchedItems.data.length} (Expected 2)`);

    if (fetchedItems.data.length !== 2) throw new Error('Item count mismatch');

    // 4. Simulate Update (Save) via RPC
    console.log('\n4. Simulating Update via RPC (save_quote_atomic)...');
    
    // Construct payload matching the hook's structure
    const payload = {
        quote: {
            id: quote.id,
            tenant_id: tenantId,
            title: 'Regression Test Quote Updated',
            status: 'draft',
            tax_percent: 10,
            shipping_amount: 50
        },
        items: [
            {
                line_number: 1,
                product_name: 'Test Item 1 Updated',
                quantity: 12,
                unit_price: 50,
                line_total: 600,
                tenant_id: tenantId
            },
            // Removed Item 2, Added Item 3
            {
                line_number: 2,
                product_name: 'Test Item 3 New',
                quantity: 1,
                unit_price: 200,
                line_total: 200,
                tenant_id: tenantId
            }
        ],
        cargo_configurations: [],
        options: []
    };

    const { data: savedId, error: saveError } = await supabase.rpc('save_quote_atomic', { p_payload: payload });

    if (saveError) throw new Error(`RPC Save Failed: ${saveError.message}`);
    console.log('Update Successful, Returned ID:', savedId);

    // 5. Verify Updates
    console.log('\n5. Verifying Updates...');
    const { data: updatedQuote } = await supabase.from('quotes').select('*').eq('id', quote.id).single();
    const { data: updatedItems } = await supabase.from('quote_items').select('*').eq('quote_id', quote.id).order('line_number');

    if (!updatedQuote) throw new Error('Updated quote not found');
    if (!updatedItems) throw new Error('Updated items not found');

    console.log('Updated Title:', updatedQuote.title);
    console.log('Updated Items Count:', updatedItems.length);
    console.log('Item 1 Name:', updatedItems[0].product_name);
    console.log('Item 2 Name:', updatedItems[1].product_name);

    if (updatedQuote.title !== 'Regression Test Quote Updated') throw new Error('Title update failed');
    if (updatedItems.length !== 2) throw new Error('Item count mismatch after update');
    if (updatedItems[0].product_name !== 'Test Item 1 Updated') throw new Error('Item 1 update failed');
    if (updatedItems[1].product_name !== 'Test Item 3 New') throw new Error('Item 2 update failed');

    // Cleanup
    console.log('\nCleaning up...');
    await supabase.from('quotes').delete().eq('id', quote.id);
    console.log('Test Quote Deleted');

    console.log('\nRegression Test PASSED');

  } catch (err: any) {
    console.error('\nRegression Test FAILED:', err.message);
    process.exit(1);
  }
}

runRegressionTest();
