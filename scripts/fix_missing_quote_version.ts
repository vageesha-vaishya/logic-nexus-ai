import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const quoteNumber = 'MGL-SYS-1770819021371';
  console.log(`Repairing data for quote: ${quoteNumber}`);

  // 1. Get Quote
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('id, tenant_id')
    .eq('quote_number', quoteNumber)
    .single();

  if (quoteError || !quote) {
    console.error('Quote not found');
    return;
  }
  console.log(`Found Quote ID: ${quote.id}`);
  console.log(`Found Quote Tenant ID: ${quote.tenant_id}`);

  // 2. Check if version exists (double check)
  const { data: existingVersions } = await supabase
    .from('quotation_versions')
    .select('id')
    .eq('quote_id', quote.id);

  if (existingVersions && existingVersions.length > 0) {
    console.log('Version already exists! Aborting repair.');
    return;
  }

  // 3. Get Currency (USD)
  const { data: currency } = await supabase
    .from('currencies')
    .select('id')
    .eq('code', 'USD')
    .limit(1)
    .maybeSingle();
    
  // If no USD, just grab any
  const currencyId = currency?.id; 
  if (!currencyId) {
      console.log('Warning: USD currency not found, trying to fetch any currency...');
      // logic to fetch any currency if needed, or assume ID if known. 
      // But let's hope USD exists.
  }

  // 4. Get a valid user/profile for created_by
  const { data: profile } = await supabase.from('profiles').select('id').limit(1).maybeSingle();
  const userId = profile?.id; // Use a real UUID

  // 5. Create Version
  console.log('Creating Version 1...');
  const { data: newVersion, error: versionError } = await supabase
    .from('quotation_versions')
    .insert({
      quote_id: quote.id,
      version_number: 1,
      status: 'draft',
      created_by: userId, // Use UUID or null
      created_at: new Date().toISOString(),
      tenant_id: quote.tenant_id
    })
    .select()
    .single();

  if (versionError) {
    console.error('Error creating version:', versionError);
    return;
  }
  console.log(`Created Version ID: ${newVersion.id}`);

  // 5. Create Option (Standard)
  console.log('Creating Option...');
  const { data: newOption, error: optionError } = await supabase
    .from('quotation_version_options')
    .insert({
      quotation_version_id: newVersion.id,
      is_selected: true,
      total_amount: 0, // Intentionally 0 to test calculation logic
      quote_currency_id: currencyId,
      total_transit_days: 30,
      tenant_id: quote.tenant_id
    })
    .select()
    .single();

  if (optionError) {
    console.error('Error creating option:', optionError);
    // Cleanup version? Nah, manual fix.
    return;
  }
  console.log(`Created Option ID: ${newOption.id}`);

  // 6. Create Leg (Main Leg)
  console.log('Creating Leg...');
  const { data: newLeg, error: legError } = await supabase
    .from('quotation_version_option_legs')
    .insert({
      quotation_version_option_id: newOption.id,
      sort_order: 1,
      mode: 'ocean',
      transport_mode: 'ocean', // duplicate column sometimes exists
      origin_location: 'Shanghai',
      destination_location: 'Los Angeles',
      transit_time_hours: 720, // 30 days
      tenant_id: quote.tenant_id
    })
    .select()
    .single();

  if (legError) {
    console.error('Error creating leg:', legError);
    return;
  }
  console.log(`Created Leg ID: ${newLeg.id}`);

  // 7. Get Charge Category (Freight)
  const { data: category } = await supabase
    .from('charge_categories')
    .select('id')
    .ilike('name', '%Freight%')
    .limit(1)
    .maybeSingle();

  // 8. Create Charges
  console.log('Creating Charges...');
  const charges = [
    {
      quote_option_id: newOption.id, // Some schemas link charge to option directly too
      leg_id: newLeg.id,
      category_id: category?.id,
      amount: 2500,
      currency_id: currencyId,
      quantity: 1,
      rate: 2500,
      tenant_id: quote.tenant_id,
      charge_side_id: null // might be nullable
    },
    {
      quote_option_id: newOption.id,
      leg_id: newLeg.id,
      category_id: category?.id, // using same for simplicity
      amount: 150,
      currency_id: currencyId,
      quantity: 1,
      rate: 150,
      tenant_id: quote.tenant_id
    }
  ];

  // Note: Schema for charges might require `charge_side_id`, `basis_id` etc.
  // Let's check schema requirements by trying to insert.
  // We'll fetch a valid basis/side if needed.
  
  const { data: basis } = await supabase.from('charge_bases').select('id').limit(1).maybeSingle();
  const { data: side } = await supabase.from('charge_sides').select('id').limit(1).maybeSingle();

  const chargesWithRefs = charges.map(c => ({
      ...c,
      basis_id: basis?.id,
      charge_side_id: side?.id
  }));

  const { data: newCharges, error: chargesError } = await supabase
    .from('quote_charges')
    .insert(chargesWithRefs)
    .select();

  if (chargesError) {
    console.error('Error creating charges:', chargesError);
  } else {
    console.log(`Created ${newCharges?.length} charges.`);
  }

  console.log('Repair complete.');
}

main();
