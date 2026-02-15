
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gzhxgoigflftharcmdqj.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6aHhnb2lnZmxmdGhhcmNtZHFqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTUxOTY4NywiZXhwIjoyMDg1MDk1Njg3fQ.MImJoQhZUG2lSQ9PpN0z1QwDI1nvA2AsYPOeVfDGMos';

if (!SUPABASE_KEY) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Mappings ---
const CONTAINER_SIZES: Record<string, string> = {};
const CONTAINER_TYPES: Record<string, string> = {};

// User provided sample data from the text template
const USER_TEMPLATE_DATA = {
   "carriers": [
     {
       "carrier_name": "Zim",
       "pricing_units": {
         "standard_20": { "ocean_freight": 1.00, "trucking": 1500.0, "total": 1554.00 }, // Total includes other hidden charges? Text says 1554.
         "open_top_40": { "ocean_freight": 3.00, "trucking": 1500.0, "total": 1503.00 },
         "flat_rack_40": { "ocean_freight": 3.00, "trucking": 1500.0, "total": 1503.00 },
         "flat_rack_collapsible_20": { "ocean_freight": 1.00, "trucking": 1500.0, "total": 1504.00 },
         "platform_20": { "ocean_freight": 3.00, "trucking": 1500.0, "total": 1503.00 },
         "high_cube_45": { "ocean_freight": 3.00, "trucking": 1500.0, "total": 1503.00 }
       },
       "remarks": "Open top 40' OP, Flat Rac 40' OF, , Platform - 20', High Cube - 45"
     },
     {
       "carrier_name": "EVERGREEN LINES",
       "pricing_units": {
         "standard_20": { "ocean_freight": 2000.00, "trucking": 1500.0, "total": 3500.00 },
         "open_top_40": { "ocean_freight": 2000.00, "trucking": 1500.0, "total": 3500.00 },
         "flat_rack_40": { "ocean_freight": 2000.00, "trucking": 1500.0, "total": 3500.00 },
         "flat_rack_collapsible_20": { "ocean_freight": 2000.00, "trucking": 1500.0, "total": 3500.00 },
         "platform_20": { "ocean_freight": 2000.00, "trucking": 1500.0, "total": 3500.00 },
         "high_cube_45": { "ocean_freight": 2000.00, "trucking": 1500.0, "total": 3500.00 }
       },
       "remarks": "All Inclusive rates from SD/Port basis"
     },
     {
       "carrier_name": "MSC",
       "pricing_units": {
         "standard_20": { "ocean_freight": 1800.00, "trucking": 1500.0, "total": 3300.00 },
         "open_top_40": { "ocean_freight": 1800.00, "trucking": 1500.0, "total": 3300.00 },
         "flat_rack_40": { "ocean_freight": 1800.00, "trucking": 1500.0, "total": 3300.00 },
         "flat_rack_collapsible_20": { "ocean_freight": 1800.00, "trucking": 1500.0, "total": 3300.00 },
         "platform_20": { "ocean_freight": 1800.00, "trucking": 1500.0, "total": 3300.00 },
         "high_cube_45": { "ocean_freight": 1800.00, "trucking": 1500.0, "total": 3300.00 }
       },
       "remarks": "Direct Service"
     }
   ]
};

async function run() {
    console.log('Starting MGL Granular Template E2E Test...');

    // 1. Get Tenant/Account
    const { data: tenants } = await supabase.from('tenants').select('id').limit(1);
    if (!tenants || tenants.length === 0) throw new Error('No tenants found');
    const tenantId = tenants[0].id;

    const { data: accounts } = await supabase.from('accounts').select('id').eq('tenant_id', tenantId).limit(1);
    const accountId = accounts && accounts.length > 0 ? accounts[0].id : null;

    // 2. Locations: Origin Rail Ramp -> POL -> POD -> Final Dest
    // We need 4 locations. We'll reuse ports if we don't have enough specific types.
    const { data: ports } = await supabase.from('ports_locations').select('id, location_name').limit(4);
    if (!ports || ports.length < 2) throw new Error('Not enough ports found for testing');
    
    const railRampId = ports[0].id; // Mock
    const polId = ports[1].id;
    const podId = ports[2] ? ports[2].id : ports[0].id;
    const finalDestId = ports[3] ? ports[3].id : ports[1].id;

    console.log(`Route: Rail Ramp (${ports[0].location_name}) -> POL (${ports[1].location_name}) -> POD -> Final Dest`);

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
    };

    // 2.2 Populate Container Sizes & Types
    // Sizes
    const { data: sizes, error: sizesError } = await supabase.from('container_sizes').select('id, code, name');
    console.log('Fetched Sizes:', sizes);
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
    console.log('Fetched Types:', types);
    if (types) {
        types.forEach(ct => {
            if (ct.code === 'GP' || ct.code === 'ST' || ct.name.toLowerCase().includes('standard')) CONTAINER_TYPES['standard'] = ct.id;
            if (ct.code === 'OT' || ct.name.toLowerCase().includes('open top')) CONTAINER_TYPES['open_top'] = ct.id;
            if (ct.code === 'FR' || ct.name.toLowerCase().includes('flat rack')) CONTAINER_TYPES['flat_rack'] = ct.id;
            if (ct.code === 'PF' || ct.name.toLowerCase().includes('platform')) CONTAINER_TYPES['platform'] = ct.id;
            if (ct.code === 'HC' || ct.name.toLowerCase().includes('high cube')) CONTAINER_TYPES['high_cube'] = ct.id;
            // Collapsible Flat Rack might be rare, map to FR
            if (ct.name.toLowerCase().includes('collapsible')) CONTAINER_TYPES['flat_rack_collapsible'] = ct.id;
        });
    }
    if (!CONTAINER_TYPES['flat_rack_collapsible']) CONTAINER_TYPES['flat_rack_collapsible'] = CONTAINER_TYPES['flat_rack'];
    if (!CONTAINER_TYPES['platform']) CONTAINER_TYPES['platform'] = CONTAINER_TYPES['flat_rack']; // Fallback
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
    const { data: templates } = await supabase.from('quote_templates').select('id').eq('layout_type', 'mgl_granular').maybeSingle();
    const templateId = templates?.id || 'cf58b647-10ab-495e-8907-cb4756e01b45';

    console.log('Creating Quote...');
    const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
            status: 'draft',
            quote_number: `MGL-TMPL-${Date.now()}`,
            title: 'MGL Template Verification',
            account_id: accountId,
            origin_port_id: polId,
            destination_port_id: podId,
            tenant_id: tenantId
        })
        .select()
        .single();

    if (quoteError) throw quoteError;
    console.log(`Quote Created: ${quote.quote_number}`);

    // 4. Create Quote Items (One for each unique config)
    const quoteItemsData = Object.entries(CONFIG_MAP).map(([key, ids]) => ({
        quote_id: quote.id,
        container_size_id: ids.size,
        container_type_id: ids.type, // Make sure column exists! If not, we might need to rely on option mapping
        quantity: 1,
        weight_kg: 10000,
        tenant_id: tenantId,
        description: `Cargo ${key}`
    }));
    
    // Check if container_type_id exists in quote_items, if not skip it
    // We'll just try inserting, if it fails we remove the column.
    // Actually, `quote_items` usually has `container_type_id`.
    try {
        await supabase.from('quote_items').insert(quoteItemsData);
    } catch (e) {
        console.warn("Could not insert container_type_id into quote_items, continuing without it.");
        const simplifiedItems = quoteItemsData.map(({container_type_id, ...rest}) => rest);
        await supabase.from('quote_items').insert(simplifiedItems);
    }

    // 5. Version
    const { data: version } = await supabase.from('quotation_versions').insert({
        quote_id: quote.id,
        version_number: 1,
        status: 'draft',
        tenant_id: tenantId
    }).select().single();

    // 6. Carriers Loop
    for (const carrierData of USER_TEMPLATE_DATA.carriers) {
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

            // Create Option
            const { data: option } = await supabase.from('quotation_version_options').insert({
                quotation_version_id: version.id,
                carrier_id: carrierId,
                container_size_id: ids.size,
                container_type_id: ids.type,
                is_selected: true,
                tenant_id: tenantId,
                transit_days: 25
            }).select().single();

            // Create Legs (Multi-Modal)
            // Leg 1: Rail (Ramp -> POL)
            const { data: leg1 } = await supabase.from('quotation_version_option_legs').insert({
                quotation_version_option_id: option.id,
                mode: 'rail',
                sort_order: 1,
                origin_location_id: railRampId,
                destination_location_id: polId,
                tenant_id: tenantId
            }).select().single();

            // Leg 2: Ocean (POL -> POD)
            const { data: leg2 } = await supabase.from('quotation_version_option_legs').insert({
                quotation_version_option_id: option.id,
                mode: 'ocean',
                sort_order: 2,
                origin_location_id: polId,
                destination_location_id: podId,
                tenant_id: tenantId
            }).select().single();

            // Leg 3: Trucking (POD -> Final)
            const { data: leg3 } = await supabase.from('quotation_version_option_legs').insert({
                quotation_version_option_id: option.id,
                mode: 'road',
                sort_order: 3,
                origin_location_id: podId,
                destination_location_id: finalDestId,
                tenant_id: tenantId
            }).select().single();

            // Charges
            const p = prices as any;
            const charges = [];

            if (p.ocean_freight) {
                charges.push({
                    quote_option_id: option.id,
                    leg_id: leg2.id,
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
                    quote_option_id: option.id,
                    leg_id: leg3.id, // Assigning trucking to delivery leg
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

            // Note: The user text has "Total" which might include other charges. 
            // Since we only have breakdown for Ocean and Trucking, we'll stick to those.
            // If we needed to match total exactly, we'd need to add a "balancing" charge, 
            // but for now we render what we have.

            if (charges.length > 0) {
                await supabase.from('quote_charges').insert(charges);
            }
        }
    }

    console.log('Data Generation Complete. Generating PDF...');

    // Generate PDF
    const { data: pdfData, error: pdfError } = await supabase.functions.invoke('generate-quote-pdf', {
        body: { quoteId: quote.id, templateId: templateId },
        headers: { 'X-E2E-Key': 'trae-bypass-verification-2026' }
    });

    if (pdfError) throw pdfError;
    
    const pdfBuffer = Buffer.from(pdfData.content, 'base64');
    fs.writeFileSync('mgl_template_output.pdf', pdfBuffer);
    console.log('PDF saved to mgl_template_output.pdf');

    // Send Email
    console.log('Sending Email to bahuguna.vimal@gmail.com...');
    const emailPayload = {
        to: ['bahuguna.vimal@gmail.com'],
        subject: 'MGL Granular Quote - User Template Scenario',
        body: `
            <h1>MGL Quotation (Template Scenario)</h1>
            <p><strong>Quote Ref:</strong> ${quote.quote_number}</p>
            <p><strong>Carriers:</strong> Zim, Evergreen, MSC</p>
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
        headers: { 'X-E2E-Key': 'trae-bypass-verification-2026' }
    });

    if (emailError) throw emailError;
    console.log('Email sent successfully.');
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
