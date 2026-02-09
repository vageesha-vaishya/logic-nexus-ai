import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyAutonomousBooking() {
  console.log('🤖 Verifying Autonomous Booking Agents...');

  // 1. Check if booking_agents table exists
  const { error: tableError } = await supabase
    .from('booking_agents')
    .select('id')
    .limit(1);

  if (tableError) {
    console.error('❌ booking_agents table check failed:', tableError.message);
    process.exit(1);
  }
  console.log('✅ booking_agents table exists.');

  // 2. Get a valid Tenant ID
  let tenantId;
  const { data: tenants, error: tenantError } = await supabase
    .from('tenants')
    .select('id')
    .limit(1);

  if (tenantError) {
    console.error('❌ Failed to get tenant:', tenantError);
    process.exit(1);
  }

  if (tenants && tenants.length > 0) {
    tenantId = tenants[0].id;
  } else {
    console.log('⚠️ No tenants found. Creating a test tenant...');
    const { data: newTenant, error: createTenantError } = await supabase
      .from('tenants')
      .insert({
        name: 'Autonomous Test Tenant',
        domain: 'auto-test.com'
      })
      .select('id')
      .single();
    
    if (createTenantError) {
       console.error('❌ Failed to create test tenant:', createTenantError.message);
       process.exit(1);
    }
    tenantId = newTenant.id;
  }
  console.log(`✅ Using Tenant ID: ${tenantId}`);

  // 3. Create a Test Agent
  const agentName = `Test Agent ${Date.now()}`;
  const { data: agent, error: agentError } = await supabase
    .from('booking_agents')
    .insert({
      tenant_id: tenantId,
      name: agentName,
      strategy: 'cheapest',
      is_active: true
    })
    .select()
    .single();

  if (agentError) {
    console.error('❌ Failed to create agent:', agentError.message);
    process.exit(1);
  }
  console.log(`✅ Created Agent: ${agent.name} (${agent.id})`);

  // 4. Create a Test Quote
  const quoteNum = `AUTO-TEST-${Date.now()}`;
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .insert({
      tenant_id: tenantId,
      quote_number: quoteNum,
      title: 'Autonomous Booking Test',
      status: 'draft'
    })
    .select()
    .single();

  if (quoteError) {
    console.error('❌ Failed to create quote:', quoteError.message);
    process.exit(1);
  }
  console.log(`✅ Created Quote: ${quote.quote_number} (${quote.id})`);

  // 5. Create Quote Version
  const { data: version, error: versionError } = await supabase
    .from('quotation_versions')
    .insert({
      tenant_id: tenantId,
      quote_id: quote.id,
      version_number: 1,
      is_active: true
    })
    .select()
    .single();

  if (versionError) {
    console.error('❌ Failed to create version:', versionError.message);
    process.exit(1);
  }
  console.log(`✅ Created Version: ${version.version_number} (${version.id})`);

  // 6. Create Options (Cheap vs Expensive)
  // We need a dummy carrier rate ID if the column is NOT NULL.
  // Let's try to fetch one or insert a dummy if needed.
  let carrierRateId = null;
  const { data: rates } = await supabase.from('carrier_rates').select('id').limit(1);
  if (rates && rates.length > 0) {
    carrierRateId = rates[0].id;
  } else {
     // Create dummy carrier rate if needed, or hope it's nullable.
     // If it fails, we know we need it.
  }

  const optionsPayload = [
    {
        tenant_id: tenantId,
        quotation_version_id: version.id,
        carrier_rate_id: carrierRateId, // Might be null
        option_name: 'Expensive Option',
        sell_subtotal: 5000,
        transit_days: 2
    },
    {
        tenant_id: tenantId,
        quotation_version_id: version.id,
        carrier_rate_id: carrierRateId,
        option_name: 'Cheap Option',
        sell_subtotal: 1000,
        transit_days: 10
    }
  ];

  const { data: options, error: optionsError } = await supabase
    .from('quotation_version_options')
    .insert(optionsPayload)
    .select();

  if (optionsError) {
     if (optionsError.message.includes('carrier_rate_id')) {
        console.warn('⚠️ carrier_rate_id is required. Attempting to create dummy carrier rate...');
        // Create dummy carrier rate logic here if needed...
        // For now, let's just fail and see.
     }
    console.error('❌ Failed to create options:', optionsError.message);
    // Cleanup
    await supabase.from('quotes').delete().eq('id', quote.id);
    process.exit(1);
  }
  console.log(`✅ Created ${options.length} Options.`);

  // 7. Execute Booking
  console.log('🔄 Executing Booking via RPC...');
  const { data: bookingId, error: rpcError } = await supabase
    .rpc('execute_booking', {
      p_agent_id: agent.id,
      p_quote_id: quote.id
    });

  if (rpcError) {
    console.error('❌ execute_booking RPC failed:', rpcError.message);
    process.exit(1);
  }
  console.log(`✅ Booking Executed! Booking ID: ${bookingId}`);

  // 8. Verify Results
  // Check Execution Log
  const { data: execLogs, error: logError } = await supabase
    .from('booking_executions')
    .select('*')
    .eq('agent_id', agent.id)
    .eq('quote_id', quote.id)
    .single();

  if (logError) {
    console.error('❌ Failed to fetch execution log:', logError.message);
  } else {
    console.log(`✅ Execution Log Found: Status=${execLogs.status}`);
    console.log(`   Strategy: ${execLogs.log.strategy}`);
    console.log(`   Selected Option: ${execLogs.log.selected_option_id}`);
  }

  // Check Customer Selection
  const { data: selection, error: selError } = await supabase
    .from('customer_selections')
    .select('*, quotation_version_options(sell_subtotal)')
    .eq('quote_id', quote.id)
    .single();

  if (selError) {
     console.error('❌ Failed to fetch customer selection:', selError.message);
  } else {
      console.log(`✅ Customer Selection Found.`);
      // @ts-ignore
      const price = selection.quotation_version_options?.sell_subtotal;
      if (price === 1000) {
          console.log('✅ CORRECT: Agent selected the cheapest option (1000 vs 5000).');
      } else {
          console.error(`❌ WRONG SELECTION: Agent selected option with price ${price}`);
      }
  }

  // Cleanup
  console.log('🧹 Cleaning up test data...');
  await supabase.from('booking_executions').delete().eq('agent_id', agent.id);
  await supabase.from('booking_agents').delete().eq('id', agent.id);
  await supabase.from('bookings').delete().eq('id', bookingId);
  await supabase.from('quotes').delete().eq('id', quote.id); // Cascades to versions/options/selections

  // =========================================================================
  // TEST 2: Fastest Strategy
  // =========================================================================
  console.log('\n🤖 Starting TEST 2: Fastest Strategy...');

  // 1. Create Agent (Fastest)
  const agentFastName = `Test Agent Fast ${Date.now()}`;
  const { data: agentFast, error: agentFastError } = await supabase
    .from('booking_agents')
    .insert({
      tenant_id: tenantId,
      name: agentFastName,
      strategy: 'fastest',
      is_active: true
    })
    .select()
    .single();

  if (agentFastError) {
    console.error('❌ Failed to create fast agent:', agentFastError.message);
    process.exit(1);
  }
  console.log(`✅ Created Fast Agent: ${agentFast.name}`);

  // 2. Create Quote
  const quoteFastNum = `AUTO-TEST-FAST-${Date.now()}`;
  const { data: quoteFast, error: quoteFastError } = await supabase
    .from('quotes')
    .insert({
      tenant_id: tenantId,
      quote_number: quoteFastNum,
      title: 'Autonomous Booking Test (Fastest)',
      status: 'draft'
    })
    .select()
    .single();
  
  if (quoteFastError) {
      console.error('❌ Failed to create fast quote:', quoteFastError.message);
      process.exit(1);
  }

  // 3. Create Version
  const { data: versionFast } = await supabase
    .from('quotation_versions')
    .insert({
      tenant_id: tenantId,
      quote_id: quoteFast.id,
      version_number: 1,
      is_active: true
    })
    .select()
    .single();

  // 4. Create Options (Cheap/Slow vs Expensive/Fast)
  const optionsFastPayload = [
    {
        tenant_id: tenantId,
        quotation_version_id: versionFast.id,
        carrier_rate_id: carrierRateId,
        option_name: 'Expensive Fast Option',
        total_sell: 5000,
        transit_days: 2
    },
    {
        tenant_id: tenantId,
        quotation_version_id: versionFast.id,
        carrier_rate_id: carrierRateId,
        option_name: 'Cheap Slow Option',
        total_sell: 1000,
        transit_days: 10
    }
  ];

  await supabase.from('quotation_version_options').insert(optionsFastPayload);
  console.log(`✅ Created Options for Fast Test (2 days vs 10 days).`);

  // 5. Execute
  console.log('🔄 Executing Fast Booking...');
  const { data: bookingFastId, error: rpcFastError } = await supabase
    .rpc('execute_booking', {
      p_agent_id: agentFast.id,
      p_quote_id: quoteFast.id
    });

  if (rpcFastError) {
      console.error('❌ execute_booking (Fast) failed:', rpcFastError.message);
      process.exit(1);
  }
  console.log(`✅ Booking Executed! Booking ID: ${bookingFastId}`);

  // 6. Verify
  const { data: selectionFast } = await supabase
    .from('customer_selections')
    .select('*, quotation_version_options(transit_days)')
    .eq('quote_id', quoteFast.id)
    .single();

  // @ts-ignore
  const transit = selectionFast.quotation_version_options?.transit_days;
  if (transit === 2) {
      console.log('✅ CORRECT: Agent selected the fastest option (2 days vs 10 days).');
  } else {
      console.error(`❌ WRONG SELECTION: Agent selected option with transit ${transit} days`);
  }

  // Cleanup Fast Test
  console.log('🧹 Cleaning up fast test data...');
  await supabase.from('booking_executions').delete().eq('agent_id', agentFast.id);
  await supabase.from('booking_agents').delete().eq('id', agentFast.id);
  await supabase.from('bookings').delete().eq('id', bookingFastId);
  await supabase.from('quotes').delete().eq('id', quoteFast.id);

  console.log('✨ Verification Complete!');
}

verifyAutonomousBooking().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
