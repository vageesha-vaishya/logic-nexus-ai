import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Prefer Service Role Key for admin tasks to bypass RLS during setup/cleanup
// Fallback to Anon Key if Service Key is not available
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase URL or Key in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('🚀 Starting Verification of quote_items_view Triggers...\n');
  console.log(`Target: ${supabaseUrl}`);

  // 1. Environment Check
  console.log('\n--- Step 1: Environment Check ---');
  try {
    // Check if view exists and is accessible
    const { error: viewError } = await supabase.from('quote_items').select('id').limit(1);
    if (viewError) {
      console.error('❌ quote_items view check failed:', viewError.message);
      if (viewError.code === '42P01') { // undefined_table
        console.error('   -> The view "quote_items" does not exist.');
      }
    } else {
      console.log('✅ quote_items view exists and is accessible');
    }

    // Skip extension table check as it is now in private schema 'logistics'
    // const { error: extError } = await supabase.from('quote_items_extension').select('id').limit(1);
    // if (extError) {
    //   console.error('❌ quote_items_extension table check failed:', extError.message);
    // } else {
    //   console.log('✅ quote_items_extension table exists and is accessible');
    // }

  } catch (err) {
    console.error('❌ Environment check error:', err);
    process.exit(1);
  }

  // 2. Setup Test Data
  console.log('\n--- Step 2: Setup Test Data ---');
  let tenantId: string | null = null;
  let quoteId: string | null = null;
  let itemId: string | null = null;

  try {
    // 2a. Get a valid Tenant
    const { data: tenants, error: tenantError } = await supabase.from('tenants').select('id').limit(1);
    if (tenantError) throw tenantError;
    if (!tenants || tenants.length === 0) {
      throw new Error('No tenants found in database. Cannot create test data.');
    }
    tenantId = tenants[0].id;
    console.log(`ℹ️  Using Tenant ID: ${tenantId}`);

    // 2b. Create a Test Quote
    const quoteNum = `TEST-VERIFY-${Date.now()}`;
    console.log(`ℹ️  Creating Quote with Number: ${quoteNum}`);
    
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .insert({
        tenant_id: tenantId,
        quote_number: quoteNum,
        title: 'Verification Test Quote',
        status: 'draft'
      })
      .select('id')
      .single();

    if (quoteError) {
        throw new Error(`Failed to create test quote: ${quoteError.message}`);
    }
    quoteId = quote.id;
    console.log(`✅ Created Test Quote ID: ${quoteId}`);

  } catch (err) {
    console.error('❌ Setup failed:', err);
    // Try to cleanup if quote was created but something else failed?
    // Unlikely here.
    process.exit(1);
  }

  // 3. Test INSERT
  console.log('\n--- Step 3: Verify INSERT Trigger ---');
  try {
    console.log('ℹ️  Inserting item into quote_items (View)...');

    const { data: newItem, error: insertError } = await supabase
      .from('quote_items')
      .insert({
        quote_id: quoteId,
        line_number: 1,
        product_name: 'Test Product Verification',
        description: 'Inserted via Verification Script',
        quantity: 10,
        unit_price: 50,
        line_total: 500, // Required
        // Extension columns
        weight_kg: 123.45,
        volume_cbm: 67.89,
        // Extra attributes
        attributes: {
          custom_tag: 'test-insert',
          verified: true
        }
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ INSERT verification failed:', insertError);
    } else {
      itemId = newItem.id;
      console.log('✅ Inserted Item ID:', newItem.id);
      
      // Verify Data Integrity via View
      if (newItem.weight_kg === 123.45 && newItem.volume_cbm === 67.89) {
          console.log('✅ PASS: Logistics columns (weight/volume) correctly stored and retrieved.');
      } else {
          console.error('❌ FAIL: Logistics columns mismatch.', newItem);
      }
      
      if (newItem.attributes?.custom_tag === 'test-insert') {
          console.log('✅ PASS: JSONB attributes correctly stored and retrieved.');
      } else {
          console.error('❌ FAIL: Attributes mismatch.', newItem.attributes);
      }
    }

  } catch (err) {
    console.error('❌ INSERT verification failed:', err);
  }

  // 4. Test UPDATE
  console.log('\n--- Step 4: Verify UPDATE Trigger ---');
  if (itemId) {
    try {
      console.log('ℹ️  Updating item in quote_items (View)...');
      
      const { data: updatedItem, error: updateError } = await supabase
        .from('quote_items')
        .update({
          weight_kg: 999.99,
          volume_cbm: 111.11,
          attributes: {
            custom_tag: 'test-update',
            updated: true
          }
        })
        .eq('id', itemId)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Update operation failed:', updateError);
      } else {
        console.log('✅ Update operation successful');
        
        // Verify Update
        if (updatedItem.weight_kg === 999.99 && updatedItem.attributes?.custom_tag === 'test-update') {
            console.log('✅ PASS: Data correctly updated.');
        } else {
            console.error('❌ FAIL: Update mismatch.', updatedItem);
        }
      }

    } catch (err) {
      console.error('❌ UPDATE verification failed:', err);
    }
  }

  // 5. Test DELETE
  console.log('\n--- Step 5: Verify DELETE Trigger ---');
  if (itemId) {
    try {
      console.log('ℹ️  Deleting item from quote_items (View)...');
      
      const { error: deleteError } = await supabase
        .from('quote_items')
        .delete()
        .eq('id', itemId);

      if (deleteError) {
        console.error('❌ Delete operation failed:', deleteError);
      } else {
        console.log('✅ Delete operation successful');
        
        const { data: checkDelete } = await supabase
          .from('quote_items')
          .select('id')
          .eq('id', itemId)
          .maybeSingle();
          
        if (!checkDelete) {
           console.log('✅ PASS: Record removed from View.');
        } else {
           console.error('❌ FAIL: Record still exists in View.');
        }
      }

    } catch (err) {
      console.error('❌ DELETE verification failed:', err);
    }
  }

  // 6. Cleanup
  console.log('\n--- Step 6: Cleanup ---');
  if (quoteId) {
    console.log(`ℹ️  Deleting Test Quote ID: ${quoteId}`);
    const { error: cleanError } = await supabase.from('quotes').delete().eq('id', quoteId);
    if (cleanError) {
        console.error('⚠️  Failed to delete test quote:', cleanError.message);
    } else {
        console.log('✅ Test Quote deleted');
    }
  }

  console.log('\n🎉 Verification Run Complete.');
}

run();
