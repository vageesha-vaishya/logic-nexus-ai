
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
// Use Service Role Key if available for E2E test to bypass RLS
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('--- Starting E2E Quote Creation Verification ---');
  console.log('Using Key starting with:', (supabaseKey || '').substring(0, 10) + '...');

  // ... (rest of logic)

  // 1. Fetch Dependencies
  console.log('Fetching master data...');
  
  // Get Container Type
  let { data: containerTypes, error: ctError } = await supabase
    .from('container_types')
    .select('*')
    .eq('code', '40ST') 
    .maybeSingle();

  if (!containerTypes) {
    console.log('40ST not found, fetching any container type...');
    const { data: anyCt } = await supabase.from('container_types').select('*').limit(1).maybeSingle();
    containerTypes = anyCt;
  }
  
  if (!containerTypes) {
      console.error('No container types found in DB.');
      process.exit(1);
  }
  console.log('Found container type:', containerTypes.id, containerTypes.name, containerTypes.code);
  const containerTypeId = containerTypes.id;

  // Get Container Size
  let { data: containerSizes, error: csError } = await supabase
    .from('container_sizes')
    .select('id, name, code')
    .or('name.eq.40,code.eq.40')
    .limit(1)
    .maybeSingle();
    
  if (!containerSizes) {
      console.log('40 size not found, fetching any container size...');
      const { data: anySize } = await supabase.from('container_sizes').select('id, name, code').limit(1).single();
      containerSizes = anySize;
  }
  
  if (!containerSizes) {
      console.error('No container sizes found!');
      process.exit(1);
  }
  console.log('Found container size:', containerSizes.id, containerSizes.name, containerSizes.code);
  const containerSizeId = containerSizes.id;

  // Get Ports
  let { data: ports, error: pError } = await supabase
    .from('ports_locations')
    .select('id, location_name')
    .limit(2);

  if (pError) console.error('Error fetching ports:', pError);
  console.log('Ports found:', ports?.length);

  if (!ports || ports.length < 2) {
      console.log('Not enough ports found in ports_locations, trying to insert dummies if possible or fail...');
      
      const { count } = await supabase.from('ports_locations').select('*', { count: 'exact', head: true });
      console.log('Total ports count:', count);
      
      if (!ports || ports.length < 2) {
         console.error('CRITICAL: Cannot find ports to link to. Aborting.');
         process.exit(1);
      }
  }
  
  const originPort = ports[0];
  const destPort = ports[1];
  console.log(`Ports: ${originPort.location_name} -> ${destPort.location_name}`);

  // Get a Customer (Account)
  let { data: account } = await supabase
    .from('accounts')
    .select('id, name, tenant_id')
    .limit(1)
    .maybeSingle();

  let tenantId = account?.tenant_id;
  
  if (!tenantId) {
      // Try fetching from user profile or just hardcode a known UUID if available in env, or gen one if RLS allows
      console.log('No account found, checking user profile...');
       const { data: { user } } = await supabase.auth.getUser();
       if (user) {
           // check profile
            const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
            tenantId = profile?.tenant_id;
       }
  }

  // If still no tenant, we might be in a dev env where we can insert a dummy account or just use a random UUID 
  // (but FK constraints might fail).
  // Let's check if we can insert an account.
  if (!tenantId) {
      console.log('No tenant_id found. Creating a dummy tenant and account...');
      tenantId = crypto.randomUUID(); // This might fail if tenant table exists and enforces FK
      
      // Try to find an existing tenant first?
      const { data: anyData } = await supabase.from('quotes').select('tenant_id').limit(1).maybeSingle();
      if (anyData) {
          tenantId = anyData.tenant_id;
          console.log('Found existing tenant_id from quotes:', tenantId);
      } else {
           console.log('Using generated tenant_id:', tenantId);
      }
      
      // Create dummy account if needed
      if (!account) {
          const newAccountId = crypto.randomUUID();
          const { error: accError } = await supabase.from('accounts').insert({
              id: newAccountId,
              tenant_id: tenantId,
              name: 'Test Account ' + Date.now()
          });
          if (!accError) {
              account = { id: newAccountId, name: 'Test Account', tenant_id: tenantId };
          } else {
               console.warn('Could not create dummy account:', accError.message);
               // Proceed without account_id if possible
          }
      }
  }

  if (!account) {
       // Just proceed without account_id, but we need tenant_id
       if (!tenantId) tenantId = crypto.randomUUID(); 
  }

  console.log('Using Tenant:', tenantId, 'Account:', account?.id);

  // 2. Prepare Quote Data (Simulating the output of QuoteTransformService)
  const quoteId = crypto.randomUUID();
  
  const quoteData = {
    id: quoteId,
    tenant_id: tenantId,
    account_id: account?.id,
    origin_port_id: originPort.id,
    destination_port_id: destPort.id,
    transport_mode: 'ocean',
    status: 'draft',
    title: 'E2E Test Quote - AI Generated'
    // version: 1 // Removed as column does not exist
  };

  // 3. Prepare Quote Items (The critical part we fixed)
  const quoteItems = [
    {
        quote_id: quoteId,
        tenant_id: tenantId,
        line_number: 1,
        type: 'container',
        container_type_id: containerTypeId,
        container_size_id: containerSizeId,
        quantity: 2,
        product_name: 'Electric Vehicles',
        unit_price: 2500,
        line_total: 5000,
        attributes: {
            hs_code: '8703.80',
            hazmat: undefined
        }
        // origin: originPort.location_name || 'New York',
        // destination: destPort.location_name || 'Tughlakabad',
        // mode: 'ocean'
    }
  ];

  // 4. Insert Quote
  console.log('Inserting Quote...');
  const { error: qError } = await supabase
    .from('quotes')
    .insert(quoteData);

  if (qError) {
      console.error('Error inserting quote:', qError);
      process.exit(1);
  }
  console.log('Quote inserted successfully.');

  // 5. Insert Quote Items
  console.log('Inserting Quote Items...');
  const { error: qiError } = await supabase
    .from('quote_items') // Verify table name, might be quote_items_core or similar if view
    .insert(quoteItems);

  if (qiError) {
      console.error('Error inserting quote items:', qiError);
      // Try quote_items_core if quote_items is a view
      console.log('Retrying with quote_items_core...');
       const { error: qiError2 } = await supabase
        .from('quote_items_core')
        .insert(quoteItems);
        
        if (qiError2) {
             console.error('Error inserting quote items (core):', qiError2);
             process.exit(1);
        }
  }
  console.log('Quote Items inserted successfully.');

  // 6. Verify Data
  console.log('Verifying inserted data...');
  const { data: fetchedItems, error: fetchError } = await supabase
    .from('quote_items')
    .select('*')
    .eq('quote_id', quoteId);

  if (fetchError) {
      console.error('Error fetching items:', fetchError);
  } else {
      console.log('Fetched Items:', JSON.stringify(fetchedItems, null, 2));
      
      const item = fetchedItems[0];
      if (item.attributes?.hs_code === '8703.80' && item.container_type_id === containerTypeId) {
          console.log('[SUCCESS] Data verification passed: HS Code and Container Type ID are correct.');
      } else {
          console.error('[FAILURE] Data verification failed.');
      }
  }
  
  // Cleanup (optional)
  // await supabase.from('quotes').delete().eq('id', quoteId);
}

main().catch(console.error);
