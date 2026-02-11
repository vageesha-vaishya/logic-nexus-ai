import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { Client } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
const envLocalPath = path.resolve(__dirname, '../.env.local');
const envPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
} else {
    dotenv.config({ path: envPath });
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gzhxgoigflftharcmdqj.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!SUPABASE_KEY) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Constants ---
const TEST_ROUTE = {
    origin: 'Mumbai',
    destination: 'New Jersey' // Will map to ports
};

const CARRIERS_TO_TEST = ['Evergreen', 'MSC', 'COSCO'];

async function run() {
    console.log('Starting Default Rates E2E Scenario...');

    // 1. Setup Tenant
    const { data: tenants } = await supabase.from('tenants').select('id').limit(1);
    if (!tenants?.length) throw new Error('No tenants found');
    const tenantId = tenants[0].id;

    const { data: accounts } = await supabase.from('accounts').select('id').eq('tenant_id', tenantId).limit(1);
    const accountId = accounts?.[0]?.id;

    // 2. Resolve Ports
    const { data: pols } = await supabase.from('ports_locations').select('id, location_name').ilike('location_name', `%${TEST_ROUTE.origin}%`).limit(1);
    const pol = pols?.[0];
    const { data: pods } = await supabase.from('ports_locations').select('id, location_name').ilike('location_name', `%${TEST_ROUTE.destination}%`).limit(1);
    const pod = pods?.[0];

    if (!pol || !pod) throw new Error(`Could not resolve ports for ${TEST_ROUTE.origin} -> ${TEST_ROUTE.destination}`);
    console.log(`Route: ${pol.location_name} -> ${pod.location_name}`);

    // 3. Resolve Carriers
    const { data: allCarriers } = await supabase.from('carriers').select('id, carrier_name');
    const carrierIds: Record<string, string> = {};
    
    for (const name of CARRIERS_TO_TEST) {
        const match = allCarriers?.find(c => c.carrier_name.toLowerCase().includes(name.toLowerCase()));
        if (match) carrierIds[name] = match.id;
        else console.warn(`Carrier ${name} not found in DB`);
    }

    // 4. Seed "Default Rates" in carrier_rates if not present
    // This simulates the "System has rates" state
    console.log('Seeding/Verifying Master Rates...');
    
    // Get Charge Categories
    const { data: cats } = await supabase.from('charge_categories').select('id, code');
    const getCatId = (code: string) => cats?.find(c => c.code.toLowerCase().includes(code))?.id || cats?.[0]?.id;
    const oceanFreightId = getCatId('freight');
    
    const { data: currencies } = await supabase.from('currencies').select('id').eq('code', 'USD').single();
    const currencyId = currencies?.id;

    for (const [name, id] of Object.entries(carrierIds)) {
        // Check if rate exists
        const { data: existing } = await supabase.from('carrier_rates')
            .select('id')
            .eq('carrier_id', id)
            .eq('origin_port_id', pol.id)
            .eq('destination_port_id', pod.id)
            .is('rate_reference_id', null) // Master rate
            .limit(1);

        let rateId = existing?.[0]?.id;

        if (!rateId) {
            console.log(`Creating Master Rate for ${name}...`);
            const { data: newRate, error } = await supabase.from('carrier_rates').insert({
                carrier_id: id,
                carrier_name: name, // Added carrier_name
                origin_port_id: pol.id,
                destination_port_id: pod.id,
                tenant_id: tenantId,
                mode: 'ocean',
                rate_type: 'spot', // Added rate_type
                base_rate: 2000, // Added base_rate
                valid_from: new Date().toISOString(),
                valid_to: new Date(Date.now() + 86400000 * 30).toISOString(),
                currency: 'USD'
            }).select().single();
            
            if (error) {
                console.error(`Failed to create rate for ${name}:`, error);
                continue;
            }
            rateId = newRate.id;

            // Add Charges
            await supabase.from('carrier_rate_charges').insert([
                { carrier_rate_id: rateId, charge_category_id: oceanFreightId, amount: 2000, currency_id: currencyId, unit: 'per_container' },
                { carrier_rate_id: rateId, charge_category_id: getCatId('fuel'), amount: 150, currency_id: currencyId, unit: 'per_container' }
            ]);
        }
    }

    // 5. Create Quote
    console.log('Creating Quote...');
    const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
            status: 'draft',
            quote_number: `MGL-DEF-${Date.now()}`,
            title: 'MGL Default Rates Test',
            account_id: accountId,
            origin_port_id: pol.id,
            destination_port_id: pod.id,
            tenant_id: tenantId
        })
        .select()
        .single();

    if (quoteError) throw quoteError;
    console.log(`Quote Created: ${quote.quote_number}`);

    // 6. Simulate "Smart Quote" - Find Rates and Link
    // We search carrier_rates matching the route
    const { data: foundRates } = await supabase.from('carrier_rates')
        .select('*, charges:carrier_rate_charges(*)')
        .eq('origin_port_id', pol.id)
        .eq('destination_port_id', pod.id)
        .is('rate_reference_id', null);

    console.log(`Found ${foundRates?.length || 0} matching rates in system.`);

    if (!foundRates?.length) throw new Error('No rates found to link!');

    // Create Version
    const { data: version } = await supabase.from('quotation_versions').insert({
        quote_id: quote.id,
        version_number: 1,
        tenant_id: tenantId
    }).select().single();

    // Link Rates (Create Options)
    const { data: sizes } = await supabase.from('container_sizes').select('id, code').limit(1);
    const sizeId = sizes?.[0]?.id;
    const { data: types } = await supabase.from('container_types').select('id, code').limit(1);
    const typeId = types?.[0]?.id;
    const { data: chargeSides } = await supabase.from('charge_sides').select('id').ilike('code', 'sell').maybeSingle();
    const sellSideId = chargeSides?.id;

    for (const rate of foundRates) {
        // Create Option
        const { data: option, error: optError } = await supabase.from('quotation_version_options').insert({
            quotation_version_id: version.id,
            carrier_id: rate.carrier_id,
            container_size_id: sizeId,
            container_type_id: typeId,
            is_selected: true,
            tenant_id: tenantId,
            carrier_rate_id: rate.id, // Link to master rate
            notes: 'System Rate Applied'
        }).select().single();

        if (optError) { console.error(optError); continue; }

        // Insert Single Leg (Ocean)
        await supabase.from('quotation_version_option_legs').insert({
            quotation_version_option_id: option.id,
            sequence: 1,
            mode: 'ocean',
            origin_location_id: pol.id,
            destination_location_id: pod.id,
            transit_time: 20
        });

        // Copy Charges to Quote Charges
        const chargesToInsert = rate.charges.map((c: any) => ({
            quote_option_id: option.id,
            category_id: c.charge_category_id,
            amount: c.amount, // Simple pass-through
            rate: c.amount,
            quantity: 1,
            currency_id: c.currency_id,
            charge_side_id: sellSideId,
            tenant_id: tenantId
        }));

        if (chargesToInsert.length) {
            await supabase.from('quote_charges').insert(chargesToInsert);
        }
    }

    // 7. Generate PDF & Email
    console.log('Generating PDF and Sending Email...');
    const { data: pdfRes, error: pdfError } = await supabase.functions.invoke('generate-quote-pdf', {
        body: { quoteId: quote.id, versionId: version.id }
    });

    if (pdfError) throw pdfError;
    console.log('PDF Generated:', pdfRes);

    const { error: emailError } = await supabase.functions.invoke('send-email', {
        body: {
            to: ['bahuguna.vimal@gmail.com'],
            subject: `MGL Default Rates Quote: ${quote.quote_number}`,
            html: `<p>Please find attached the quote ${quote.quote_number} generated from System Default Rates.</p>`,
            attachments: [{
                filename: `${quote.quote_number}.pdf`,
                content: pdfRes.base64, // Assuming function returns base64
                contentType: 'application/pdf'
            }]
        },
        headers: { 'X-E2E-Key': process.env.E2E_KEY || 'trae-e2e-test' }
    });

    if (emailError) throw emailError;
    console.log('Email Sent Successfully!');
}

run().catch(console.error);
