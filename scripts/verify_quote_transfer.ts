
import { createClient } from '@supabase/supabase-js';
import { QuoteOptionService } from '../src/services/QuoteOptionService';
import { mapOptionToQuote } from '../src/lib/quote-mapper';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyQuoteTransfer() {
  console.log('Starting Quote Transfer Verification...');

  // 1. Setup Context (User, Tenant, Quote, Version)
  // We'll reuse the logic from test_quote_flow.ts or just query existing
  
  const { data: users, error: userError } = await supabase
    .from('profiles')
    .select('id, tenant_id')
    .not('tenant_id', 'is', null)
    .limit(1);

  let userId, tenantId;

  if (users && users.length > 0) {
    userId = users[0].id;
    tenantId = users[0].tenant_id;
  } else {
    // Fallback
    const { data: tenants } = await supabase.from('tenants').select('id').limit(1);
    const { data: allUsers } = await supabase.from('profiles').select('id').limit(1);
    
    if (tenants && tenants.length > 0) tenantId = tenants[0].id;
    if (allUsers && allUsers.length > 0) userId = allUsers[0].id;
  }

  if (!userId || !tenantId) {
    console.error('Failed to find user or tenant');
    return;
  }
  console.log(`Using User: ${userId}, Tenant: ${tenantId}`);

  // Create a dummy Quote & Version
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .insert({
      tenant_id: tenantId,
      owner_id: userId,
      title: 'Quote Transfer Verification',
      status: 'draft',
      valid_until: new Date(Date.now() + 86400000).toISOString()
    })
    .select()
    .single();

  if (quoteError) {
    console.error('Failed to create quote:', quoteError);
    return;
  }
  console.log('Created Quote:', quote.id);

  const { data: version, error: versionError } = await supabase
    .from('quotation_versions')
    .insert({
      tenant_id: tenantId,
      quote_id: quote.id,
      version_number: 1,
      status: 'draft'
    })
    .select()
    .single();

  if (versionError) {
    console.error('Failed to create version:', versionError);
    return;
  }
  console.log('Created Version:', version.id);

  // 2. Mock Rate Payload (Simulating output from generateSimulatedRates + QuickQuoteModal)
  const mockRate = {
    id: `sim_air_${Date.now()}`,
    mode: 'air',
    // transport_mode intentionally omitted to test fallback
    tier: 'market',
    option_name: 'Emirates SkyCargo Standard',
    carrier_name: 'Emirates SkyCargo',
    total_amount: 1500.50,
    currency: 'USD',
    transit_time: { details: '3 Days' },
    source_attribution: 'Simulation Engine',
    legs: [], // Empty legs, as per simulation engine
    charges: [],
    meta: { route_type: 'Direct', stops: 0 }
  };

  // 3. Mock Rate Mapper
  // We need a minimal implementation that QuoteOptionService uses
  const mockRateMapper = {
    getModeId: (mode: string) => '00000000-0000-0000-0000-000000000000', // Mock UUID
    getProviderId: (name: string) => null,
    getServiceTypeId: (mode: string, tier: string) => null, // Should return a valid ID if strict FK
    getSideId: (code: string) => '00000000-0000-0000-0000-000000000000',
    getCatId: (name: string) => '00000000-0000-0000-0000-000000000000',
    getBasisId: (code: string) => '00000000-0000-0000-0000-000000000000',
    getCurrId: (code: string) => '00000000-0000-0000-0000-000000000000'
  };

  // We need REAL IDs for rateMapper to avoid FK violations
  // Let's fetch some real IDs
  const { data: modes } = await supabase.from('service_modes').select('id, code');
  const { data: serviceTypes } = await supabase.from('service_types').select('id, code, transport_modes(code)');
  const { data: currencies } = await supabase.from('currencies').select('id, code');
  const { data: sides } = await supabase.from('charge_sides').select('id, code');
  const { data: cats } = await supabase.from('charge_categories').select('id, code');
  const { data: bases } = await supabase.from('charge_bases').select('id, code');

  const realRateMapper = {
    getModeId: (mode: string) => modes?.find(m => m.code === mode)?.id || modes?.[0]?.id,
    getProviderId: (name: string) => null,
    getServiceTypeId: (mode: string, tier: string) => {
        // Find a service type that matches the mode
        const st = serviceTypes?.find((st: any) => {
            const tm = st.transport_modes;
            // Handle both array and object response from Supabase join
            const tmCode = Array.isArray(tm) ? tm[0]?.code : tm?.code;
            return tmCode === mode;
        });
        return st?.id || serviceTypes?.[0]?.id;
    },
    getSideId: (code: string) => sides?.find(s => s.code === code)?.id || sides?.[0]?.id,
    getCatId: (name: string) => cats?.find(c => c.code === 'FREIGHT')?.id || cats?.[0]?.id,
    getBasisId: (code: string) => bases?.find(b => b.code === 'PER_SHIPMENT')?.id || bases?.[0]?.id,
    getCurrId: (code: string) => currencies?.find(c => c.code === 'USD')?.id || currencies?.[0]?.id
  };

  // 4. Instantiate Service and Call addOptionToVersion
  const service = new QuoteOptionService(supabase);
  
  try {
    const optionId = await service.addOptionToVersion({
        tenantId,
        versionId: version.id,
        rate: mockRate,
        rateMapper: realRateMapper,
        source: 'quick_quote',
        context: {
            origin: 'JFK',
            destination: 'LHR'
        }
    });

    console.log('Successfully added option:', optionId);

    // 5. Verify Data in DB
    const { data: legs, error: legsError } = await supabase
        .from('quotation_version_option_legs')
        .select('*')
        .eq('quotation_version_option_id', optionId);

    if (legsError) throw legsError;

    console.log('Created Legs:', legs.length);
    if (legs.length > 0) {
        console.log('Leg Mode:', legs[0].mode);
        console.log('Leg Type:', legs[0].leg_type);
        
        if (legs[0].mode === 'air') {
            console.log('SUCCESS: Leg mode is correctly set to AIR');
        } else {
            console.error('FAILURE: Leg mode is ' + legs[0].mode + ' (expected air)');
        }

        // Verify Charges
        const { data: charges, error: chargesError } = await supabase
            .from('quote_charges')
            .select('*')
            .eq('quote_option_id', optionId);

        if (chargesError) console.error('Error fetching charges:', chargesError);
        else {
            console.log('Created Charges:', charges.length);
            // Verify charge leg assignment
            const unassignedCharges = charges.filter(c => !c.leg_id);
            if (unassignedCharges.length > 0) {
                console.error('FAILURE: Found charges without leg_id:', unassignedCharges.length);
            } else {
                console.log('SUCCESS: All charges assigned to legs');
            }
        }

        // Verify Financials in Option Header
        const { data: option } = await supabase
            .from('quotation_version_options')
            .select('*')
            .eq('id', optionId)
            .single();
        
        if (option) {
            console.log(`Financials: Sell ${option.total_sell}, Buy ${option.total_buy}, Margin ${option.margin_amount}`);
            if (option.total_sell > 0) {
                 console.log('SUCCESS: Financials calculated');
            } else {
                 console.warn('WARNING: Total sell is 0');
            }
        }
    } else {
        console.error('FAILURE: No legs created');
    }

  } catch (err) {
    console.error('Error adding option:', err);
  }

  // Cleanup (optional, but good for local dev)
  // await supabase.from('quotations').delete().eq('id', quote.id);
}

verifyQuoteTransfer().catch(console.error);
