
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix for __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });

const SUPABASE_URL = 'https://gzhxgoigflftharcmdqj.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6aHhnb2lnZmxmdGhhcmNtZHFqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTUxOTY4NywiZXhwIjoyMDg1MDk1Njg3fQ.MImJoQhZUG2lSQ9PpN0z1QwDI1nvA2AsYPOeVfDGMos';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function verifyFCLAndHazmat() {
  console.log('Starting FCL and Hazmat DB Verification...');

  try {
    // 1. Get Prerequisites (Quote ID, Container Type, Container Size)
    const { data: quotes, error: quoteError } = await supabase
      .from('quotes')
      .select('id')
      .limit(1);

    if (quoteError || !quotes || quotes.length === 0) {
      console.log('No quotes found. Creating a dummy quote...');
      // Create a dummy quote if none exists
      // We need an account_id usually.
    const { data: accounts } = await supabase.from('accounts').select('id').limit(1);
    let accountId;
    
    if (!accounts?.length) {
        console.log('No accounts found. Creating a dummy account...');
        // We need a tenant_id for account creation usually, let's try to get one or assume RLS handles it if we were auth'd user
        // But we are using ANON key, so we might need to manually supply tenant_id if RLS doesn't block us.
        // Or checking if we can just create one.
        // Actually, let's check tenants first.
        const { data: tenants } = await supabase.from('tenants').select('id').limit(1);
        if (!tenants?.length) throw new Error('No tenants found. Cannot create account.');
        
        const { data: newAccount, error: accError } = await supabase.from('accounts').insert({
            name: 'Test Account',
            tenant_id: tenants[0].id,
            status: 'active'
        }).select().single();
        
        if (accError) throw new Error(`Failed to create dummy account: ${accError.message}`);
        accountId = newAccount.id;
    } else {
        accountId = accounts[0].id;
    }
    
    // We need a tenant_id for quote as well
    const { data: tenants } = await supabase.from('tenants').select('id').limit(1);
    if (!tenants?.length) throw new Error('No tenants found.');
    const tenantId = tenants[0].id;

    const { data: newQuote, error: createError } = await supabase.from('quotes').insert({
        account_id: accountId,
        tenant_id: tenantId,
        quote_number: 'TEST-' + Date.now(), // Ensure unique quote number
        title: 'Test Quote',
        status: 'draft',
        origin_country: 'US',
        destination_country: 'GB'
    }).select().single();
      
      if (createError) throw new Error(`Failed to create dummy quote: ${createError.message}`);
      quotes[0] = newQuote;
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
      line_number: 1,
      product_name: 'Test FCL Item',
      quantity: 1,
      unit_price: 1000,
      type: 'container',
      container_type_id: containerTypeId,
      container_size_id: containerSizeId,
      attributes: {
        stackable: true
      }
    };

    const hazmatItem = {
      quote_id: quoteId,
      line_number: 2,
      product_name: 'Test Hazmat Item',
      quantity: 5,
      unit_price: 50,
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
    // Note: attributes come back as JSONB
    const savedHazmat = hazmatResult.attributes?.hazmat;
    if (savedHazmat && savedHazmat.unNumber === 'UN1234') {
         console.log('PASS: Hazmat details persisted (UN1234)');
    } else {
         console.error('FAIL: Hazmat details missing or incorrect', hazmatResult.attributes);
         success = false;
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
