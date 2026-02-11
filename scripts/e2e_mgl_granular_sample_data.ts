
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
// Use the key that we know works if env is missing
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6aHhnb2lnZmxmdGhhcmNtZHFqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTUxOTY4NywiZXhwIjoyMDg1MDk1Njg3fQ.MImJoQhZUG2lSQ9PpN0z1QwDI1nvA2AsYPOeVfDGMos';

if (!SUPABASE_KEY) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Mappings ---
const CONTAINER_SIZES: Record<string, string> = {
  'standard_20': 'd08b391a-5a4a-4469-b95a-f392d4caaf64',
  'open_top_40': 'a2f27faf-8db7-4683-9d94-edc1ad2b7271',
  'flat_rack_40': '81365527-4156-4a23-9ace-8bb22be732c0',
  'flat_rack_collapsible_20': '3590e647-5aaf-4269-a0be-57857a975508',
  'platform_20': '3590e647-5aaf-4269-a0be-57857a975508', // Reuse Flat Rack 20
  'high_cube_45': 'a335ef9b-ba17-4fe6-adbc-75be779e816b'
};

const CHARGE_CATS: Record<string, string> = {
  'ocean_freight': 'fb1a45f6-f50a-47be-8fe5-56f084c26ef4', // Freight
  'trucking': 'fb1a45f6-f50a-47be-8fe5-56f084c26ef4', // Freight
  'baf': 'b3f2744e-b5bb-4b1d-9f3f-12732dd50e1f', // Fuel Surcharge
  'bfs': 'b3f2744e-b5bb-4b1d-9f3f-12732dd50e1f', // Fuel Surcharge
  'eps': '5eae3f34-90e3-4d5a-bb0b-c34778a4dac7', // Other
  'handling': '0b7797ff-66e0-414d-a17b-6179e10d4787'
};

const USER_DATA = {
   "carriers": [ 
     { 
       "carrier_name": "EVERGREEN LINES", 
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
    console.log('Starting Granular MGL E2E Test...');

    // 1. Get Tenant/Account
    const { data: tenants } = await supabase.from('tenants').select('id').limit(1);
    if (!tenants || tenants.length === 0) throw new Error('No tenants found');
    const tenantId = tenants[0].id;

    const { data: accounts } = await supabase.from('accounts').select('id').eq('tenant_id', tenantId).limit(1);
    const accountId = accounts && accounts.length > 0 ? accounts[0].id : null;

    // 2. Get Ports (Generic Origin/Dest)
    const { data: ports, error: portError } = await supabase.from('ports_locations').select('id, location_name').limit(2);
    if (portError) throw portError;
    console.log('Ports found:', ports?.length);
    if (!ports || ports.length < 2) throw new Error('Not enough ports found for testing');
    const originPortId = ports[0].id;
    const destPortId = ports[1].id;
    const originPortName = ports[0].location_name;
    const destPortName = ports[1].location_name;

    // 2.1 Get Metadata for Charges
    const { data: currencies } = await supabase.from('currencies').select('id, code').eq('code', 'USD').maybeSingle();
    const currencyId = currencies?.id;

    const { data: chargeBases } = await supabase.from('charge_bases').select('id, code').ilike('code', '%container%').limit(1);
    const basisId = chargeBases?.[0]?.id;

    const { data: chargeSides } = await supabase.from('charge_sides').select('id, code').ilike('code', 'sell').maybeSingle();
    const sideId = chargeSides?.id;
    
    if (!currencyId || !basisId || !sideId) {
        throw new Error(`Missing metadata: Currency=${currencyId}, Basis=${basisId}, Side=${sideId}`);
    }

    // 3. Create Quote
    console.log('Creating Quote...');
    const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
            status: 'draft',
            quote_number: `MGL-SAMPLE-${Date.now()}`,
            title: 'MGL Sample Data E2E',
            account_id: accountId,
            origin_port_id: originPortId,
            destination_port_id: destPortId,
            tenant_id: tenantId
        })
        .select()
        .single();
    
    if (quoteError) throw quoteError;
    console.log(`Quote Created: ${quote.quote_number} (${quote.id})`);

    // 4. Create Quote Items (One for each unique size in USER_DATA)
    const sizeKeys = Object.keys(USER_DATA.carriers[0].pricing_units);
    const quoteItemsData = sizeKeys.map(key => ({
        quote_id: quote.id,
        container_size: CONTAINER_SIZES[key],
        quantity: 1,
        weight_kg: 10000,
        tenant_id: tenantId,
        description: `Sample Cargo for ${key}`
    }));

    await supabase.from('quote_items').insert(quoteItemsData);
    console.log('Quote Items Created.');

    // 5. Create Quotation Version
    console.log('Creating Quotation Version...');
    const { data: version, error: versionError } = await supabase.from('quotation_versions').insert({
        quote_id: quote.id,
        version_number: 1,
        status: 'draft',
        tenant_id: tenantId
    }).select().single();

    if (versionError) throw versionError;

    // 6. Loop Carriers -> Create Options -> Create Legs -> Create Charges
    for (const carrierData of USER_DATA.carriers) {
        // Find or Create Carrier
        let carrierId;
        const { data: existingCarrier } = await supabase.from('carriers').select('id').ilike('carrier_name', carrierData.carrier_name).maybeSingle();
        
        if (existingCarrier) {
            carrierId = existingCarrier.id;
        } else {
            console.log(`Creating Carrier: ${carrierData.carrier_name}`);
            const { data: newCarrier, error: carrierError } = await supabase.from('carriers').insert({
                carrier_name: carrierData.carrier_name,
                scac: carrierData.carrier_name.substring(0, 4).toUpperCase() + Math.floor(Math.random() * 1000), 
                tenant_id: tenantId,
                mode: 'ocean'
            }).select().single();
            
            if (carrierError) {
                 console.error('Error creating carrier:', carrierError);
                 const { data: retryCarrier } = await supabase.from('carriers').select('id').ilike('carrier_name', carrierData.carrier_name).maybeSingle();
                 if (retryCarrier) carrierId = retryCarrier.id;
                 else throw carrierError;
            } else {
                 carrierId = newCarrier.id;
            }
        }

        console.log(`Processing Carrier: ${carrierData.carrier_name}`);

        // For each size in pricing_units, create an OPTION
        for (const [sizeKey, charges] of Object.entries(carrierData.pricing_units)) {
            const sizeId = CONTAINER_SIZES[sizeKey];
            
            // Create Option
            const { data: option, error: optionError } = await supabase.from('quotation_version_options').insert({
                quotation_version_id: version.id,
                carrier_id: carrierId,
                container_size_id: sizeId,
                is_selected: true, 
                valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                tenant_id: tenantId
            }).select().single();

            if (optionError) throw optionError;

            // Create Legs for THIS Option
            // Leg 1: Road (Origin -> Origin Port)
             const { data: leg1, error: leg1Error } = await supabase.from('quotation_version_option_legs').insert({
                quotation_version_option_id: option.id, 
                mode: 'road',
                sort_order: 1,
                origin_location_id: originPortId, 
                destination_location_id: originPortId, 
                tenant_id: tenantId
            }).select().single();
            if (leg1Error) throw leg1Error;

            // Leg 2: Ocean (Origin Port -> Dest Port)
            const { data: leg2, error: leg2Error } = await supabase.from('quotation_version_option_legs').insert({
                quotation_version_option_id: option.id,
                mode: 'ocean',
                sort_order: 2,
                origin_location_id: originPortId,
                destination_location_id: destPortId,
                tenant_id: tenantId
            }).select().single();
            if (leg2Error) throw leg2Error;

            // Create Charges
            const chargeInserts = [];
            
            const createCharge = (amount: number, categoryId: string, legId: string, name: string) => ({
                quote_option_id: option.id,
                leg_id: legId,
                category_id: categoryId,
                amount: amount,
                rate: amount,
                quantity: 1,
                currency_id: currencyId,
                basis_id: basisId,
                charge_side_id: sideId,
                tenant_id: tenantId,
                note: name,
                sort_order: 1
            });

            if (charges.trucking) {
                chargeInserts.push(createCharge(charges.trucking, CHARGE_CATS['trucking'], leg1.id, 'Trucking'));
            }

            if (charges.ocean_freight) {
                chargeInserts.push(createCharge(charges.ocean_freight, CHARGE_CATS['ocean_freight'], leg2.id, 'Ocean Freight'));
            }

            if (charges.eps) {
                chargeInserts.push(createCharge(charges.eps, CHARGE_CATS['eps'], leg2.id, 'EPS'));
            }

             if (charges.baf) {
                chargeInserts.push(createCharge(charges.baf, CHARGE_CATS['baf'], leg2.id, 'BAF'));
            }

             if (charges.bfs) {
                chargeInserts.push(createCharge(charges.bfs, CHARGE_CATS['bfs'], leg2.id, 'BFS'));
            }

            if (chargeInserts.length > 0) {
                const { error: chargesError } = await supabase.from('quote_charges').insert(chargeInserts);
                if (chargesError) throw chargesError;
            }
        }
    }

    console.log('Options and Charges Created.');

    // Generate PDF
    console.log('Generating PDF...');
    const { data: pdfData, error: pdfError } = await supabase.functions.invoke('generate-quote-pdf', {
        body: { quoteId: quote.id, templateId: 'cf58b647-10ab-495e-8907-cb4756e01b45' },
        headers: { 'X-E2E-Key': 'trae-bypass-verification-2026' }
    });

    if (pdfError) throw pdfError;
    if (!pdfData || !pdfData.content) throw new Error('PDF Generation returned no content');

    // Save locally
    const pdfBuffer = Buffer.from(pdfData.content, 'base64');
    fs.writeFileSync('mgl_sample_data_output.pdf', pdfBuffer);
    console.log('PDF saved to mgl_sample_data_output.pdf');

    // Send Email
    console.log('Sending Email...');
    const emailPayload = {
        to: ['bahuguna.vimal@gmail.com'],
        subject: 'MGL Granular Quote (Sample Data E2E)',
        body: `
            <h1>MGL Quotation - Sample Data</h1>
            <p>Please find attached the quote generated from sample data.</p>
            <p><strong>Quote Ref:</strong> ${quote.quote_number}</p>
            <p><strong>Carriers:</strong> Evergreen, MSC, COSCO</p>
            <p><strong>Scenarios:</strong> Multi-Mode, Multi-Option, Granular Charges (EPS, BAF, BFS).</p>
        `,
        provider: 'resend',
        attachments: [
            {
                filename: `Quote_${quote.quote_number}.pdf`,
                content: pdfData.content, // Base64
                contentType: 'application/pdf'
            }
        ]
    };

    const { data: emailData, error: emailError } = await supabase.functions.invoke('send-email', {
        body: emailPayload,
        headers: { 'X-E2E-Key': 'trae-bypass-verification-2026' }
    });

    if (emailError) throw emailError;
    console.log('Email sent successfully:', emailData);
}

run().catch(console.error);
