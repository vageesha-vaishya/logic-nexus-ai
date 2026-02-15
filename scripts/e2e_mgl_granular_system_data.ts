import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { Client } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env - try local first, then default .env
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

if (!DATABASE_URL) {
    console.error('Missing DATABASE_URL');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const pgClient = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// --- Mappings ---
const CONTAINER_SIZES: Record<string, string> = {};
const CONTAINER_TYPES: Record<string, string> = {};

// User provided sample data
const SYSTEM_DATA = {
   "carriers": [ 
     { 
       "carrier_name": "EVERGREEN LINES", 
       "transit_time": null, 
       "frequency": null, 
       "pricing_units": { 
         "standard_20": { "eps": 300.0, "ocean_freight": 2000.0, "trucking": 1500.0, "total": 3800.0 }, 
         "open_top_40": { "eps": 300.0, "ocean_freight": 2000.0, "trucking": 1500.0, "total": 3800.0 }, 
         "flat_rack_40": { "eps": 300.0, "ocean_freight": 2000.0, "trucking": 1500.0, "total": 3800.0 }, 
         "flat_rack_collapsible_20": { "eps": 300.0, "ocean_freight": 2000.0, "trucking": 1500.0, "total": 3800.0 }, 
         "platform_20": { "eps": 0.0, "ocean_freight": 2000.0, "trucking": 1500.0, "total": 3500.0 }, 
         "high_cube_45": { "eps": 0.0, "ocean_freight": 2000.0, "trucking": 1500.0, "total": 3500.0 } 
       }, 
       "remarks": "All Inclusive rates from SD/Port basis" 
     }, 
     { 
       "carrier_name": "MSC", 
       "transit_time": null, 
       "frequency": null, 
       "pricing_units": { 
         "standard_20": { "baf": 200.0, "ocean_freight": 1800.0, "trucking": 1500.0, "total": 3500.0 }, 
         "open_top_40": { "baf": 200.0, "ocean_freight": 1800.0, "trucking": 1500.0, "total": 3500.0 }, 
         "flat_rack_40": { "baf": 200.0, "ocean_freight": 1800.0, "trucking": 1500.0, "total": 3500.0 }, 
         "flat_rack_collapsible_20": { "baf": 200.0, "ocean_freight": 1800.0, "trucking": 1500.0, "total": 3500.0 }, 
         "platform_20": { "baf": 200.0, "ocean_freight": 1800.0, "trucking": 1500.0, "total": 3500.0 }, 
         "high_cube_45": { "baf": 200.0, "ocean_freight": 1800.0, "trucking": 1500.0, "total": 3500.0 } 
       }, 
       "remarks": "All Inclusive rates from SD/Port basis" 
     }, 
     { 
       "carrier_name": "COSCO", 
       "transit_time": null, 
       "frequency": null, 
       "pricing_units": { 
         "standard_20": { "bfs": 75.0, "eps": 38.0, "ocean_freight": 1600.0, "trucking": 1500.0, "total": 3213.0 }, 
         "open_top_40": { "bfs": 75.0, "eps": 38.0, "ocean_freight": 1600.0, "trucking": 1500.0, "total": 3213.0 }, 
         "flat_rack_40": { "bfs": 75.0, "eps": 38.0, "ocean_freight": 1600.0, "trucking": 1500.0, "total": 3213.0 }, 
         "flat_rack_collapsible_20": { "bfs": 75.0, "eps": 38.0, "ocean_freight": 1600.0, "trucking": 1500.0, "total": 3213.0 }, 
         "platform_20": { "bfs": 75.0, "eps": 38.0, "ocean_freight": 1600.0, "trucking": 1500.0, "total": 3213.0 }, 
         "high_cube_45": { "bfs": 75.0, "eps": 38.0, "ocean_freight": 1600.0, "trucking": 1500.0, "total": 3213.0 } 
       }, 
       "remarks": "All Inclusive rates from SD/Port basis" 
     } 
   ] 
};

async function run() {
    console.log('Starting MGL Granular System Data E2E Test...');

    // 1. Get Tenant/Account
    const { data: tenants } = await supabase.from('tenants').select('id').limit(1);
    if (!tenants || tenants.length === 0) throw new Error('No tenants found');
    const tenantId = tenants[0].id;

    const { data: accounts } = await supabase.from('accounts').select('id').eq('tenant_id', tenantId).limit(1);
    const accountId = accounts && accounts.length > 0 ? accounts[0].id : null;

    // 2. Locations: Rail Ramp -> POL -> POD -> Final Dest
    // Update: Using 'CHICAGO' and 'Port of New York and New Jersey' based on DB check
    const locationNames = [
        'Port of Seattle', 
        'Seattle Rail Terminal', 
        'CHICAGO', 
        'Port of New York and New Jersey'
    ];
    
    const { data: locations } = await supabase
        .from('ports_locations')
        .select('id, location_name')
        .in('location_name', locationNames);

    const locationMap: Record<string, string> = {};
    locations?.forEach(l => locationMap[l.location_name] = l.id);
    
    // Alias for old names if needed by logic below
    if (locationMap['CHICAGO']) locationMap['Chicago Rail Ramp'] = locationMap['CHICAGO'];
    if (locationMap['Port of New York and New Jersey']) locationMap['New York Port'] = locationMap['Port of New York and New Jersey'];

    const railRampId = locationMap['Chicago Rail Ramp']; 
    const polId = locationMap['Port of Seattle'];
    const podId = locationMap['New York Port'];
    const finalDestId = locationMap['New York Port'];

    if (!railRampId || !polId || !podId) {
        console.error('Missing locations:', Object.keys(locationMap));
        throw new Error('Not enough ports found for testing');
    }

    console.log(`Route: Rail Ramp (Chicago) -> POL (Seattle) -> POD (NY) -> Final Dest (NY)`);

    // 2.1 Metadata
    const { data: currencies } = await supabase.from('currencies').select('id, code').eq('code', 'USD').maybeSingle();
    const currencyId = currencies?.id;
    const { data: chargeBases } = await supabase.from('charge_bases').select('id, code').ilike('code', '%container%').limit(1);
    const basisId = chargeBases?.[0]?.id;
    const { data: chargeSides } = await supabase.from('charge_sides').select('id, code').ilike('code', 'sell').maybeSingle();
    const sellSideId = chargeSides?.id;

    // Dynamic Charge Categories
    const { data: cats } = await supabase.from('charge_categories').select('id, code, name');
    const getCatId = (codePart: string) => cats?.find(c => c.code.toLowerCase().includes(codePart.toLowerCase()) || c.name.toLowerCase().includes(codePart.toLowerCase()))?.id || cats?.[0]?.id;

    const CHARGE_CATS_DYNAMIC = {
        'ocean_freight': getCatId('freight') || getCatId('ocean'),
        'trucking': getCatId('truck') || getCatId('transport'),
        'rail': getCatId('rail') || getCatId('transport'),
        'handling': getCatId('handling'),
        'baf': getCatId('fuel') || getCatId('baf'),
        'bfs': getCatId('fuel') || getCatId('bfs'), 
        'eps': getCatId('equipment') || getCatId('surcharge')
    };

    // 2.2 Populate Container Sizes & Types
    // Sizes
    const { data: sizes, error: sizesError } = await supabase.from('container_sizes').select('id, code, name');
    if (sizesError) console.error('Sizes Error:', sizesError);
    if (sizes) {
        sizes.forEach(cs => {
            const label = (cs.code || cs.name || '').toLowerCase();
            if (label.includes('20')) CONTAINER_SIZES['20'] = cs.id;
            if (label.includes('40')) CONTAINER_SIZES['40'] = cs.id;
            if (label.includes('45')) CONTAINER_SIZES['45'] = cs.id;
        });
    }
    // Fallbacks
    if (!CONTAINER_SIZES['45']) CONTAINER_SIZES['45'] = CONTAINER_SIZES['40'];

    // Types
    const { data: types } = await supabase.from('container_types').select('id, code, name');
    if (types) {
        types.forEach(ct => {
            if (ct.code === 'GP' || ct.code === 'ST' || ct.name.toLowerCase().includes('standard')) CONTAINER_TYPES['standard'] = ct.id;
            if (ct.code === 'OT' || ct.name.toLowerCase().includes('open top')) CONTAINER_TYPES['open_top'] = ct.id;
            if (ct.code === 'FR' || ct.name.toLowerCase().includes('flat rack')) CONTAINER_TYPES['flat_rack'] = ct.id;
            if (ct.code === 'PF' || ct.name.toLowerCase().includes('platform')) CONTAINER_TYPES['platform'] = ct.id;
            if (ct.code === 'HC' || ct.name.toLowerCase().includes('high cube')) CONTAINER_TYPES['high_cube'] = ct.id;
            if (ct.name.toLowerCase().includes('collapsible')) CONTAINER_TYPES['flat_rack_collapsible'] = ct.id;
        });
    }
    if (!CONTAINER_TYPES['flat_rack_collapsible']) CONTAINER_TYPES['flat_rack_collapsible'] = CONTAINER_TYPES['flat_rack'];
    if (!CONTAINER_TYPES['platform']) CONTAINER_TYPES['platform'] = CONTAINER_TYPES['flat_rack']; 
    if (!CONTAINER_TYPES['high_cube']) CONTAINER_TYPES['high_cube'] = CONTAINER_TYPES['standard'];

    // Map user keys to ID pairs
    const CONFIG_MAP: Record<string, {size: string, type: string}> = {
        'standard_20': { size: CONTAINER_SIZES['20'], type: CONTAINER_TYPES['standard'] },
        'open_top_40': { size: CONTAINER_SIZES['40'], type: CONTAINER_TYPES['open_top'] },
        'flat_rack_40': { size: CONTAINER_SIZES['40'], type: CONTAINER_TYPES['flat_rack'] },
        'flat_rack_collapsible_20': { size: CONTAINER_SIZES['20'], type: CONTAINER_TYPES['flat_rack_collapsible'] },
        'platform_20': { size: CONTAINER_SIZES['20'], type: CONTAINER_TYPES['platform'] },
        'high_cube_45': { size: CONTAINER_SIZES['45'], type: CONTAINER_TYPES['high_cube'] }
    };

    // 3. Create Quote
    // Force default if not found or ensure granular
    const { data: templates } = await supabase.from('quote_templates').select('id').eq('layout_type', 'mgl_granular').maybeSingle();
    // Pass undefined if not found to trigger default in Edge Function (which is now updated to mgl_granular)
    const templateId = templates?.id; 

    console.log('Creating Quote...');
    const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
            status: 'draft',
            quote_number: `MGL-SYS-${Date.now()}`,
            title: 'MGL System Data Verification',
            account_id: accountId,
            origin_port_id: polId,
            destination_port_id: podId,
            tenant_id: tenantId
        })
        .select()
        .single();

    if (quoteError) throw quoteError;
    console.log(`Quote Created: ${quote.quote_number}`);

    // 4. Create Quote Items
    const quoteItemsData = Object.entries(CONFIG_MAP).map(([key, ids], index) => ({
        quote_id: quote.id,
        line_number: index + 1,
        product_name: 'General Cargo',
        unit_price: 1000,
        line_total: 1000,
        container_size_id: ids.size,
        container_type_id: ids.type,
        quantity: 1,
        weight_kg: 10000,
        tenant_id: tenantId,
        description: `Cargo ${key}`
    }));
    
    try {
        const { error: itemsError } = await supabase.from('quote_items').insert(quoteItemsData);
        if (itemsError) {
             console.warn("Error inserting quote_items:", itemsError);
             throw itemsError;
        }
        console.log(`Inserted ${quoteItemsData.length} quote items.`);
    } catch (e) {
        console.warn("Could not insert container_type_id into quote_items, continuing without it.");
        const simplifiedItems = quoteItemsData.map(({container_type_id, ...rest}) => rest);
        const { error: simpleError } = await supabase.from('quote_items').insert(simplifiedItems);
        if (simpleError) console.error("Final fallback failed for quote_items:", simpleError);
    }

    // 5. Version
    const { data: version } = await supabase.from('quotation_versions').insert({
        quote_id: quote.id,
        version_number: 1,
        status: 'draft',
        tenant_id: tenantId
    }).select().single();

    // 6. Carriers Loop
    await pgClient.connect();
    
    for (const carrierData of SYSTEM_DATA.carriers) {
        // Find/Create Carrier
        let carrierId;
        const { data: existingCarrier } = await supabase.from('carriers').select('id').ilike('carrier_name', carrierData.carrier_name).maybeSingle();
        if (existingCarrier) carrierId = existingCarrier.id;
        else {
            const { data: newCarrier } = await supabase.from('carriers').insert({
                carrier_name: carrierData.carrier_name,
                scac: carrierData.carrier_name.substring(0,4).toUpperCase(),
                tenant_id: tenantId,
                mode: 'ocean'
            }).select().single();
            carrierId = newCarrier.id;
        }

        console.log(`Processing ${carrierData.carrier_name}`);

        for (const [configKey, prices] of Object.entries(carrierData.pricing_units)) {
            const ids = CONFIG_MAP[configKey];
            if (!ids || !ids.size || !ids.type) {
                console.warn(`Missing IDs for ${configKey}, skipping`);
                continue;
            }

            // Create Option using PG directly to bypass potential schema cache issues
            let optionId;
            try {
                const res = await pgClient.query(`
                    INSERT INTO quotation_version_options 
                    (quotation_version_id, carrier_id, container_size_id, container_type_id, is_selected, tenant_id, transit_days, notes)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    RETURNING id
                `, [version.id, carrierId, ids.size, ids.type, true, tenantId, 25, carrierData.remarks]);
                optionId = res.rows[0].id;
            } catch (pgErr) {
                 console.error(`Failed to create option (PG) for ${configKey} with carrier ${carrierData.carrier_name}:`, pgErr);
                 continue;
            }

            // Create Legs (Multi-Modal)
            // Leg 1: Rail (Ramp -> POL)
            const { data: leg1 } = await supabase.from('quotation_version_option_legs').insert({
                quotation_version_option_id: optionId,
                mode: 'rail',
                sort_order: 1,
                origin_location_id: railRampId,
                destination_location_id: polId,
                tenant_id: tenantId
            }).select().single();

            // Leg 2: Ocean (POL -> POD)
            const { data: leg2 } = await supabase.from('quotation_version_option_legs').insert({
                quotation_version_option_id: optionId,
                mode: 'ocean',
                sort_order: 2,
                origin_location_id: polId,
                destination_location_id: podId,
                tenant_id: tenantId
            }).select().single();

            // Leg 3: Trucking (POD -> Final)
            const { data: leg3 } = await supabase.from('quotation_version_option_legs').insert({
                quotation_version_option_id: optionId,
                mode: 'road',
                sort_order: 3,
                origin_location_id: podId,
                destination_location_id: finalDestId,
                tenant_id: tenantId
            }).select().single();

            // Charges
            const p = prices as any;
            const charges = [];

            // Add Rail Charge (Leg 1) - Mocking a flat fee for Rail
            charges.push({
                quote_option_id: optionId,
                leg_id: leg1?.id,
                category_id: CHARGE_CATS_DYNAMIC['rail'],
                amount: 500, // Fixed mock amount for rail
                rate: 500,
                quantity: 1,
                currency_id: currencyId,
                basis_id: basisId,
                charge_side_id: sellSideId,
                tenant_id: tenantId,
                note: 'Rail Freight (Inland)'
            });

            if (p.ocean_freight) {
                charges.push({
                    quote_option_id: optionId,
                    leg_id: leg2?.id,
                    category_id: CHARGE_CATS_DYNAMIC['ocean_freight'],
                    amount: p.ocean_freight,
                    rate: p.ocean_freight,
                    quantity: 1,
                    currency_id: currencyId,
                    basis_id: basisId,
                    charge_side_id: sellSideId,
                    tenant_id: tenantId,
                    note: 'Ocean Freight'
                });
            }
            if (p.trucking) {
                charges.push({
                    quote_option_id: optionId,
                    leg_id: leg3?.id, 
                    category_id: CHARGE_CATS_DYNAMIC['trucking'],
                    amount: p.trucking,
                    rate: p.trucking,
                    quantity: 1,
                    currency_id: currencyId,
                    basis_id: basisId,
                    charge_side_id: sellSideId,
                    tenant_id: tenantId,
                    note: 'Trucking'
                });
            }
            if (p.eps) {
                charges.push({
                    quote_option_id: optionId,
                    leg_id: leg2?.id, 
                    category_id: CHARGE_CATS_DYNAMIC['eps'],
                    amount: p.eps,
                    rate: p.eps,
                    quantity: 1,
                    currency_id: currencyId,
                    basis_id: basisId,
                    charge_side_id: sellSideId,
                    tenant_id: tenantId,
                    note: 'Equipment Position Surcharge'
                });
            }
            if (p.baf) {
                 charges.push({
                    quote_option_id: optionId,
                    leg_id: leg2?.id, 
                    category_id: CHARGE_CATS_DYNAMIC['baf'],
                    amount: p.baf,
                    rate: p.baf,
                    quantity: 1,
                    currency_id: currencyId,
                    basis_id: basisId,
                    charge_side_id: sellSideId,
                    tenant_id: tenantId,
                    note: 'BAF'
                });
            }
            if (p.bfs) {
                 charges.push({
                    quote_option_id: optionId,
                    leg_id: leg2?.id, 
                    category_id: CHARGE_CATS_DYNAMIC['bfs'],
                    amount: p.bfs,
                    rate: p.bfs,
                    quantity: 1,
                    currency_id: currencyId,
                    basis_id: basisId,
                    charge_side_id: sellSideId,
                    tenant_id: tenantId,
                    note: 'BFS'
                });
            }

            if (charges.length > 0) {
                await supabase.from('quote_charges').insert(charges);
            }
        }
    }
    
    await pgClient.end();

    console.log('Data Generation Complete. Generating PDF...');

    // Generate PDF
    const { data: pdfData, error: pdfError } = await supabase.functions.invoke('generate-quote-pdf', {
        body: { quoteId: quote.id, versionId: version.id, templateId: templateId },
        headers: { 'X-E2E-Key': 'trae-bypass-verification-2026' }
    });

    if (pdfData?.traceLogs) {
        console.log("\n--- PDF Generation Trace Logs ---");
        pdfData.traceLogs.forEach((log: string) => console.log(log));
        console.log("---------------------------------\n");
    }

    if (pdfError) throw pdfError;
    
    const pdfBuffer = Buffer.from(pdfData.content, 'base64');
    console.log(`\nPDF Content Length: ${pdfBuffer.length} bytes`);
    fs.writeFileSync('mgl_system_data_output.pdf', pdfBuffer);
    console.log('PDF saved to mgl_system_data_output.pdf');

    // Send Email
    console.log('Sending Email to bahuguna.vimal@gmail.com...');
    const emailPayload = {
        to: ['bahuguna.vimal@gmail.com'],
        subject: 'MGL Granular Quote - System Data Scenario',
        body: `
            <h1>MGL Quotation (System Data Scenario)</h1>
            <p><strong>Quote Ref:</strong> ${quote.quote_number}</p>
            <p><strong>Carriers:</strong> Evergreen, MSC, COSCO</p>
            <p><strong>Route:</strong> Rail Ramp -> POL -> POD -> Final Dest</p>
            <p><strong>Equipment:</strong> Standard 20, Open Top 40, Flat Rack 40, etc.</p>
        `,
        provider: 'resend',
        attachments: [
            {
                filename: `Quote_${quote.quote_number}.pdf`,
                content: pdfData.content,
                contentType: 'application/pdf'
            }
        ]
    };

    const { error: emailError } = await supabase.functions.invoke('send-email', {
        body: emailPayload,
        headers: { 'X-E2E-Key': process.env.E2E_BYPASS_KEY || 'trae-e2e-test' }
    });

    if (emailError) throw emailError;
    console.log('Email sent successfully.');
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
