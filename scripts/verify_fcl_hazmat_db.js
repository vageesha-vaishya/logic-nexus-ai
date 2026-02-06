
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyFCLAndHazmat() {
  console.log('Starting FCL and Hazmat DB Verification...');

  try {
    // 1. Get Prerequisites (Quote ID, Container Type, Container Size)
    // We need an existing quote or create a dummy one.
    // For simplicity, let's try to find an existing draft quote.
    const { data: quotes, error: quoteError } = await supabase
      .from('quotes')
      .select('id')
      .limit(1);

    if (quoteError || !quotes || quotes.length === 0) {
      throw new Error('No quotes found to test against. Please create a quote first.');
    }
    const quoteId = quotes[0].id;
    console.log(`Using Quote ID: ${quoteId}`);

    // Get Container Type and Size
    const { data: cTypes } = await supabase.from('container_types').select('id').limit(1);
    const { data: cSizes } = await supabase.from('container_sizes').select('id').limit(1);

    if (!cTypes?.length || !cSizes?.length) {
      throw new Error('Missing container types or sizes in DB.');
    }
    const containerTypeId = cTypes[0].id;
    const containerSizeId = cSizes[0].id;
    console.log(`Using Container Type ID: ${containerTypeId}, Size ID: ${containerSizeId}`);

    // 2. Prepare Test Items
    const fclItem = {
      quote_id: quoteId,
      product_name: 'Test FCL Item',
      quantity: 1,
      type: 'container', // New field
      container_type_id: containerTypeId, // New field
      container_size_id: containerSizeId, // New field
      attributes: {
        stackable: true
      }
    };

    const hazmatItem = {
      quote_id: quoteId,
      product_name: 'Test Hazmat Item',
      quantity: 5,
      type: 'loose',
      attributes: {
        hazmat: {
          unNumber: 'UN1234',
          class: '3',
          packingGroup: 'II',
          flashPoint: { value: 25, unit: 'C' }
        }
      }
    };

    // 3. Insert Items
    console.log('Inserting Test Items...');
    const { data: inserted, error: insertError } = await supabase
      .from('quote_items')
      .insert([fclItem, hazmatItem])
      .select();

    if (insertError) {
      throw new Error(`Insert failed: ${insertError.message}`);
    }
    console.log(`Inserted ${inserted.length} items.`);

    // 4. Verification
    const fclResult = inserted.find(i => i.product_name === 'Test FCL Item');
    const hazmatResult = inserted.find(i => i.product_name === 'Test Hazmat Item');

    let success = true;

    // Verify FCL
    if (fclResult.type !== 'container') {
        console.error('FAIL: FCL Item type mismatch', fclResult.type);
        success = false;
    } else {
        console.log('PASS: FCL Item type is "container"');
    }

    if (fclResult.container_type_id !== containerTypeId) {
        console.error('FAIL: Container Type ID mismatch');
        success = false;
    } else {
        console.log('PASS: Container Type ID persisted');
    }

    if (fclResult.container_size_id !== containerSizeId) {
        console.error('FAIL: Container Size ID mismatch');
        success = false;
    } else {
        console.log('PASS: Container Size ID persisted');
    }

    // Verify Hazmat
    const savedHazmat = fclResult.attributes?.hazmat || hazmatResult.attributes?.hazmat;
    if (!savedHazmat) {
        // Wait, I checked fclResult attributes for hazmat? No, I should check hazmatResult
        if (hazmatResult.attributes?.hazmat?.unNumber === 'UN1234') {
             console.log('PASS: Hazmat details persisted (UN1234)');
        } else {
             console.error('FAIL: Hazmat details missing or incorrect', hazmatResult.attributes);
             success = false;
        }
    }

    // 5. Cleanup
    console.log('Cleaning up...');
    await supabase.from('quote_items').delete().in('id', inserted.map(i => i.id));
    console.log('Cleanup done.');

    if (success) {
        console.log('✅ VERIFICATION SUCCESSFUL');
    } else {
        console.error('❌ VERIFICATION FAILED');
        process.exit(1);
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

verifyFCLAndHazmat();
