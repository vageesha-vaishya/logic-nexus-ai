const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTestQuote() {
  console.log('Creating test quote with dutiable items...');

  // 1. Get Tenant ID (required)
  const { data: tenants, error: tenantError } = await supabase
    .from('tenants')
    .select('id')
    .limit(1);

  if (tenantError || !tenants || tenants.length === 0) {
    console.error('Error fetching tenant:', tenantError || 'No tenants found');
    return;
  }
  const tenantId = tenants[0].id;
  console.log('Using Tenant ID:', tenantId);

  // Helper to get country ID
  async function getCountryId(code) {
      const { data } = await supabase.from('countries').select('id').eq('code_iso2', code).single();
      return data ? data.id : null;
  }

  const cnId = await getCountryId('CN');
  const usId = await getCountryId('US');
  console.log('Country IDs:', { CN: cnId, US: usId });

  await seedRates(supabase);

  // 2. Get or Create Ports
  // Origin: Shanghai, CN
  let originPortId;
  const { data: originPorts } = await supabase
    .from('ports_locations')
    .select('id')
    .eq('country_id', cnId) 
    .limit(1);

  if (originPorts && originPorts.length > 0) {
    originPortId = originPorts[0].id;
  } else {
    // Try by location_code if country_id didn't work (schema varies)
    const { data: originPortsCode } = await supabase
        .from('ports_locations')
        .select('id')
        .ilike('location_name', '%Shanghai%')
        .limit(1);
    
    if (originPortsCode && originPortsCode.length > 0) {
        originPortId = originPortsCode[0].id;
    } else {
        // Create one
        const { data: newPort, error: portError } = await supabase
        .from('ports_locations')
        .insert({
            name: 'Shanghai Port',
            iata_code: 'SHA',
            country_id: cnId,
            type: 'sea',
            tenant_id: tenantId 
        })
        .select()
        .single();
        if (portError) {
            console.error('Error creating origin port:', portError);
            // Fallback: proceed without port if allowed, but likely not
        } else {
            originPortId = newPort.id;
        }
    }
  }

  // Destination: Los Angeles, US
  let destPortId;
  const { data: destPorts } = await supabase
    .from('ports_locations')
    .select('id')
    .eq('country_id', usId)
    .limit(1);

  if (destPorts && destPorts.length > 0) {
    destPortId = destPorts[0].id;
  } else {
     const { data: destPortsCode } = await supabase
        .from('ports_locations')
        .select('id')
        .ilike('location_name', '%Los Angeles%')
        .limit(1);
    
    if (destPortsCode && destPortsCode.length > 0) {
        destPortId = destPortsCode[0].id;
    } else {
        // Create one
        const { data: newPort, error: portError } = await supabase
        .from('ports_locations')
        .insert({
            name: 'Los Angeles Port',
            iata_code: 'LAX',
            country_id: usId,
            type: 'sea',
            tenant_id: tenantId 
        })
        .select()
        .single();
        if (portError) {
            console.error('Error creating dest port:', portError);
        } else {
            destPortId = newPort.id;
        }
    }
  }

  console.log('Origin Port:', originPortId, 'Dest Port:', destPortId);

  // 3. Create Quote
  const quotePayload = {
    tenant_id: tenantId,
    title: 'Landed Cost Audit Quote',
    status: 'draft',
    quote_number: 'AUDIT-' + Date.now(), // Generate a number if not auto-generated
    origin_port_id: originPortId,
    destination_port_id: destPortId,
    // Add billing/shipping address with country for fallback
    shipping_address: { country: 'US', city: 'Los Angeles' },
    billing_address: { country: 'US', city: 'Los Angeles' }
  };

  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .insert(quotePayload)
    .select()
    .single();

  if (quoteError) {
    console.error('Error creating quote:', quoteError);
    // If origin_port_id/destination_port_id columns don't exist, try without them
    if (quoteError.message.includes('column') && quoteError.message.includes('does not exist')) {
        console.log('Retrying without port IDs...');
        delete quotePayload.origin_port_id;
        delete quotePayload.destination_port_id;
        const { data: retryQuote, error: retryError } = await supabase
            .from('quotes')
            .insert(quotePayload)
            .select()
            .single();
        
        if (retryError) {
            console.error('Retry failed:', retryError);
            return;
        }
        console.log('Quote created (retry):', retryQuote.id);
        
        // We need to handle item creation for retryQuote
        await createItems(retryQuote.id);
        return retryQuote.id;
    }
    return;
  }

  console.log('Quote created:', quote.id);
  await createItems(quote.id);
}

async function createItems(quoteId) {
    // 4. Create Items with HS Codes
    const items = [
        {
        quote_id: quoteId,
        line_number: 1,
        product_name: 'Laptop',
        quantity: 10,
        unit_price: 1000,
        line_total: 10000,
        attributes: { hs_code: '8471300100', weight: 20 }
        },
        {
        quote_id: quoteId,
        line_number: 2,
        product_name: 'Leather Shoes',
        quantity: 50,
        unit_price: 50,
        line_total: 2500,
        attributes: { hs_code: '6403996050', weight: 40 }
        },
        {
        quote_id: quoteId,
        line_number: 3,
        product_name: 'Cotton T-Shirt',
        quantity: 100,
        unit_price: 10,
        line_total: 1000,
        attributes: { hs_code: '6109100004', weight: 15 }
        }
    ];

    const { error: itemsError } = await supabase
        .from('quote_items')
        .insert(items);

    if (itemsError) {
        console.error('Error creating items:', itemsError);
        return;
    }

    console.log('Items created successfully.');

    // 5. Verify RPC calculation
    console.log('Verifying RPC calculation...');
    const rpcItems = items.map(i => ({
        hs_code: i.attributes.hs_code,
        value: i.quantity * i.unit_price,
        quantity: i.quantity,
        weight: i.attributes.weight,
        origin_country: 'CN'
    }));

    const { data: landedCost, error: rpcError } = await supabase.rpc('calculate_landed_cost', {
        items: rpcItems,
        destination_country: 'US'
    });

    if (rpcError) {
        console.error('RPC Error:', rpcError);
    } else {
        console.log('Landed Cost Calculation Result:');
        console.log(JSON.stringify(landedCost, null, 2));

    // DEBUG: Verify DB Schema
    const { data: columns, error: colError } = await supabase
        .rpc('get_table_columns', { p_table_name: 'duty_rates' });
    
    // Fallback if RPC doesn't exist
    if (colError) {
         console.log('Schema check RPC failed, trying direct select...');
         const { data: sample, error: sampleError } = await supabase
            .from('duty_rates')
            .select('*')
            .limit(1);
         if (sampleError) console.error('Sample Select Error:', sampleError);
         else console.log('Sample Row Keys:', sample && sample[0] ? Object.keys(sample[0]) : 'Table empty');
    } else {
        console.log('Duty Rates Columns:', columns);
    }
    
    // DEBUG: Verify DB Data
    console.log('--- DEBUG INFO ---');
    const { data: debugHts } = await supabase
        .from('aes_hts_codes')
        .select('id, hts_code')
        .in('hts_code', ['8471.30.01.00', '6403.99.60.50', '6109.10.00.04']);
    console.log('HTS Codes in DB:', debugHts);

    if (debugHts && debugHts.length > 0) {
        const ids = debugHts.map(h => h.id);
        const { data: debugRates } = await supabase
            .from('duty_rates')
            .select('*')
            .in('aes_hts_id', ids);
        console.log('Duty Rates in DB:', debugRates);
    }
}
}

async function seedRates(supabase) {
    console.log('Seeding duty rates...');
    const rates = [
        { code: '8471.30.01.00', rate: 0, type: 'free' },
        { code: '6403.99.60.50', rate: 0.085, type: 'ad_valorem' }, // 8.5%
        { code: '6109.10.00.04', rate: 0.165, type: 'ad_valorem' }  // 16.5%
    ];

    for (const r of rates) {
        // 1. Get AES HTS ID
        // Clean code first? RPC handles it, but let's be safe
        let { data: hts, error: htsError } = await supabase
            .from('aes_hts_codes')
            .select('id')
            .eq('hts_code', r.code)
            .maybeSingle();
        
        if (!hts) {
            console.log(`Creating HTS code ${r.code}`);
            const { data: newHts, error: createError } = await supabase
                .from('aes_hts_codes')
                .insert({
                    hts_code: r.code,
                    category: 'Test Category',
                    description: 'Test Item ' + r.code,
                    uom1: 'No.'
                })
                .select()
                .single();
            if (createError) {
                console.error(`Error creating HTS ${r.code}:`, createError);
                continue;
            }
            hts = newHts;
        }

        // 2. Insert Duty Rate
        // Check existing
        const { data: existingRate } = await supabase
            .from('duty_rates')
            .select('id')
            .eq('aes_hts_id', hts.id)
            .eq('country_code', 'US')
            .maybeSingle();

        if (!existingRate) {
            console.log(`Creating duty rate for ${r.code}`);
            const { error: rateError } = await supabase.from('duty_rates').insert({
                aes_hts_id: hts.id,
                // jurisdiction: 'US', // Schema doesn't have jurisdiction in this version?
                country_code: 'US',
                rate_type: r.type,
                rate_value: r.rate,
                effective_date: new Date().toISOString()
            });
            if (rateError) {
                console.error(`Error creating rate for ${r.code}:`, rateError);
            }
        }
    }
}

createTestQuote();
