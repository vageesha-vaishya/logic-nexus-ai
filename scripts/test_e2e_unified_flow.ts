
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  console.log('Starting Unified E2E Quotation Flow Test...');

  // 1. Create a Quote (Draft)
  const quoteNum = `Q-TEST-${Date.now()}`;
  console.log(`Creating Quote: ${quoteNum}`);
  
  // Fetch a valid tenant_id
  const { data: existingQuote } = await supabase
    .from('quotes')
    .select('tenant_id')
    .not('tenant_id', 'is', null)
    .limit(1)
    .single();

  const tenantId = existingQuote?.tenant_id || '00000000-0000-0000-0000-000000000000'; // Fallback
  console.log(`Using Tenant ID: ${tenantId}`);

  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .insert({
      quote_number: quoteNum,
      title: 'Unified Flow Test Quote',
      status: 'draft',
      tenant_id: tenantId,
      // Add other required fields if necessary
    })
    .select()
    .single();

  if (quoteError) {
    console.error('Error creating quote:', quoteError);
    return;
  }
  console.log(`Quote created: ${quote.id}`);

  // 2. Create Quotation Version
  const { data: version, error: verError } = await supabase
    .from('quotation_versions')
    .insert({
      quote_id: quote.id,
      version_number: 1,
      tenant_id: tenantId
    })
    .select()
    .single();

  if (verError) {
    console.error('Error creating version:', verError);
    return;
  }
  console.log(`Version created: ${version.id}`);

  // 3. Scenario 1: Default Rates (Quick Quote path simulation)
  // Insert into quotation_version_options
  const { data: option1, error: optError1 } = await supabase
    .from('quotation_version_options')
    .insert({
      quotation_version_id: version.id,
      tenant_id: tenantId,
      option_name: 'Quick Quote Option',
      total_amount: 1500.00,
      quote_currency_id: null, // Assuming NULL defaults or we need to fetch a currency ID. 
      // If we need a currency ID, we should fetch one.
      is_selected: true,
      total_transit_days: 30
    })
    .select()
    .single();

  if (optError1) {
    console.error('Error creating option 1:', optError1);
    // If currency constraint fails, try to fetch USD
  } else {
    console.log(`Option 1 created: ${option1.id}`);
    
    // Insert Legs for Option 1
    const { error: legsError1 } = await supabase
      .from('quotation_version_option_legs')
      .insert([
        {
          quotation_version_option_id: option1.id,
          sort_order: 1,
          mode: 'road',
          origin_location: 'Warehouse A',
          destination_location: 'Port of LA',
          tenant_id: tenantId
        },
        {
          quotation_version_option_id: option1.id,
          sort_order: 2,
          mode: 'ocean',
          origin_location: 'Port of LA',
          destination_location: 'Shanghai Port',
          tenant_id: tenantId
        }
      ]);
      
    if (legsError1) console.error('Error creating legs 1:', legsError1);
    else console.log('Legs for Option 1 created.');
  }

  // 4. Scenario 2: System Test Data (Smart Quote path simulation)
  const { data: option2, error: optError2 } = await supabase
    .from('quotation_version_options')
    .insert({
      quotation_version_id: version.id,
      tenant_id: tenantId,
      option_name: 'Smart Quote Option (AI)',
      total_amount: 2500.00,
      is_selected: false,
      total_transit_days: 25,
      ai_generated: true,
      reliability_score: 95
    })
    .select()
    .single();

  if (optError2) {
    console.error('Error creating option 2:', optError2);
  } else {
    console.log(`Option 2 created: ${option2.id}`);
    
    // Insert Legs for Option 2
    const { error: legsError2 } = await supabase
      .from('quotation_version_option_legs')
      .insert([
        {
          quotation_version_option_id: option2.id,
          sort_order: 1,
          mode: 'air',
          origin_location: 'JFK',
          destination_location: 'LHR',
          tenant_id: tenantId
        }
      ]);
      
    if (legsError2) console.error('Error creating legs 2:', legsError2);
    else console.log('Legs for Option 2 created.');
  }

  // 5. Verify Hydration (The Query used in useQuoteRepository.ts)
  console.log('\nVerifying Hydration Logic...');
  const { data: hydrationData, error: hydError } = await supabase
    .from('quotation_versions')
    .select(`
        id, 
        version_number, 
        quotation_version_options (
            id, 
            is_selected, 
            total_amount, 
            quote_currency:quote_currency_id (code),
            total_transit_days, 
            quotation_version_option_legs (
                id,
                sort_order,
                mode,
                provider_id,
                origin_location,
                destination_location,
                transit_time_hours
            )
        )
    `)
    .eq('quote_id', quote.id)
    .order('version_number', { ascending: false })
    .limit(1)
    .single();

  if (hydError) {
    console.error('Hydration Query Failed:', hydError);
  } else {
    console.log('Hydration Query Successful!');
    
    // Simulate Frontend Mapping
    const mappedOptions = hydrationData.quotation_version_options?.map((opt: any) => ({
        id: opt.id,
        is_primary: opt.is_selected,
        total_amount: opt.total_amount,
        currency: opt.quote_currency?.code || 'USD',
        transit_time_days: opt.total_transit_days,
        legs: opt.quotation_version_option_legs?.map((leg: any) => ({
            id: leg.id,
            sequence_number: leg.sort_order,
            transport_mode: leg.mode,
            origin: leg.origin_location,
            destination: leg.destination_location
        })).sort((a: any, b: any) => a.sort_order - b.sort_order) || []
    })) || [];

    console.log(`Mapped Options Found: ${mappedOptions.length}`);
    mappedOptions.forEach((opt: any, i: number) => {
        console.log(`Option ${i+1}: ${opt.is_primary ? '(Primary)' : ''}`);
        console.log(`  Amount: ${opt.total_amount} ${opt.currency}`);
        console.log(`  Legs: ${opt.legs.length}`);
        opt.legs.forEach((leg: any) => {
            console.log(`    - ${leg.transport_mode}: ${leg.origin} -> ${leg.destination}`);
        });
    });

    if (mappedOptions.length === 2 && mappedOptions[0].legs.length > 0) {
        console.log('SUCCESS: Data structure verified.');
    } else {
        console.error('FAILURE: Data structure mismatch.');
    }
  }

  // 5.5 Verify Leg Update Persistence (Simulating Edit Mode)
  console.log('\nVerifying Leg Update Persistence...');
  // Pick the first leg of the first option
  const { data: legsToUpdate } = await supabase
    .from('quotation_version_option_legs')
    .select('id')
    .eq('quotation_version_option_id', option1.id)
    .limit(1);

  if (legsToUpdate && legsToUpdate.length > 0) {
      const legId = legsToUpdate[0].id;
      const newTransitHours = 48;
      
      const { error: updateError } = await supabase
        .from('quotation_version_option_legs')
        .update({ transit_time_hours: newTransitHours })
        .eq('id', legId);

      if (updateError) {
          console.error('Failed to update leg:', updateError);
      } else {
          // Verify update
          const { data: updatedLeg } = await supabase
            .from('quotation_version_option_legs')
            .select('transit_time_hours')
            .eq('id', legId)
            .single();
            
          if (updatedLeg?.transit_time_hours === newTransitHours) {
              console.log('SUCCESS: Leg update persisted correctly.');
          } else {
              console.error(`FAILURE: Leg update mismatch. Expected ${newTransitHours}, got ${updatedLeg?.transit_time_hours}`);
          }
      }
  } else {
      console.warn('No legs found to test update.');
  }

  // 6. Send Email
  console.log('\nSending Email to bahuguna.vimal@gmail.com...');
  
  const { data: emailData, error: emailError } = await supabase.functions.invoke('send-email', {
    body: {
        to: ['bahuguna.vimal@gmail.com'],
        subject: `Unified Flow Test Quote: ${quoteNum}`,
        body: `<h1>Unified Flow Test Quote</h1><p>Quote Number: ${quoteNum}</p><p>Quote ID: ${quote.id}</p><p>This is a test email verifying the end-to-end quotation flow.</p>`,
        text: `Unified Flow Test Quote. Quote Number: ${quoteNum}. Quote ID: ${quote.id}`
    }
  });

  if (emailError) {
    console.error('Email sending failed:', emailError);
  } else {
    console.log('Email sent successfully!', emailData);
  }
}

runTest().catch(console.error);
