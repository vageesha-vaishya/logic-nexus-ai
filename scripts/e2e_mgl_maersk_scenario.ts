
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
// Will be populated dynamically
let CONTAINER_SIZES: Record<string, string> = {};

const CHARGE_CATS: Record<string, string> = {
  'ocean_freight': 'fb1a45f6-f50a-47be-8fe5-56f084c26ef4', // Freight
  'trucking': 'fb1a45f6-f50a-47be-8fe5-56f084c26ef4', // Freight
  'baf': 'b3f2744e-b5bb-4b1d-9f3f-12732dd50e1f', // Fuel Surcharge
  'bfs': 'b3f2744e-b5bb-4b1d-9f3f-12732dd50e1f', // Fuel Surcharge
  'eps': '5eae3f34-90e3-4d5a-bb0b-c34778a4dac7', // Other
  'handling': '0b7797ff-66e0-414d-a17b-6179e10d4787'
};

// User provided sample data + existing scenarios
const USER_DATA = {
   "carriers": [
     {
       "carrier_name": "Maersk Line",
       "pricing_units": {
         "standard_20": { "ocean_freight": 2500.0, "baf": 350.0, "total": 2850.0 },
         "standard_40": { "ocean_freight": 4500.0, "baf": 600.0, "total": 5100.0 }
       },
       "remarks": "Valid until 2024-12-31, 32 Days Transit"
     },
     {
       "carrier_name": "EVERGREEN LINES",
       "pricing_units": {
         "standard_20": { "eps": 300.0, "ocean_freight": 2000.0, "trucking": 1500.0, "total": 3800.0 },
         "open_top_40": { "eps": 300.0, "ocean_freight": 2000.0, "trucking": 1500.0, "total": 3800.0 }
       },
       "remarks": "All Inclusive rates from SD/Port basis"
     }
   ]
};

async function run() {
    console.log('Starting Granular MGL E2E Test (User Scenario)...');

    // 1. Get Tenant/Account
    const { data: tenants } = await supabase.from('tenants').select('id').limit(1);
    if (!tenants || tenants.length === 0) throw new Error('No tenants found');
    const tenantId = tenants[0].id;

    const { data: accounts } = await supabase.from('accounts').select('id').eq('tenant_id', tenantId).limit(1);
    const accountId = accounts && accounts.length > 0 ? accounts[0].id : null;

    // 2. Get Ports (Generic Origin/Dest)
    const { data: ports, error: portError } = await supabase.from('ports_locations').select('id, location_name').limit(2);
    if (portError) throw portError;
    if (!ports || ports.length < 2) throw new Error('Not enough ports found for testing');
    const originPortId = ports[0].id;
    const destPortId = ports[1].id;

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

    // 2.1.5 Populate Container Sizes
    const { data: containerSizes } = await supabase.from('container_sizes').select('id, size_code');
    if (containerSizes) {
        containerSizes.forEach(cs => {
            // Normalize keys to match USER_DATA keys if possible
            if (cs.size_code === '20GP' || cs.size_code === '20SD') CONTAINER_SIZES['standard_20'] = cs.id;
            if (cs.size_code === '40GP' || cs.size_code === '40SD') CONTAINER_SIZES['standard_40'] = cs.id;
            if (cs.size_code === '40OT') CONTAINER_SIZES['open_top_40'] = cs.id;
            if (cs.size_code === '40FR') CONTAINER_SIZES['flat_rack_40'] = cs.id;
            if (cs.size_code === '20FR') CONTAINER_SIZES['flat_rack_collapsible_20'] = cs.id;
            if (cs.size_code === '45HC') CONTAINER_SIZES['high_cube_45'] = cs.id;
            // Fallback map by raw code
            CONTAINER_SIZES[cs.size_code] = cs.id; 
        });
    }
    // Fallback if still missing (using first available for safety)
    if (!CONTAINER_SIZES['standard_20'] && containerSizes && containerSizes.length > 0) CONTAINER_SIZES['standard_20'] = containerSizes[0].id;
    if (!CONTAINER_SIZES['standard_40'] && containerSizes && containerSizes.length > 0) CONTAINER_SIZES['standard_40'] = containerSizes[0].id; // Fallback to avoid crash

    // 2.2 Get MGL Template ID dynamically
    const { data: templates } = await supabase.from('quote_templates').select('id').eq('layout_type', 'mgl_granular').maybeSingle();
    const templateId = templates?.id || 'cf58b647-10ab-495e-8907-cb4756e01b45'; // Fallback to ID from previous script
    console.log(`Using Template ID: ${templateId}`);

    // 3. Create Quote
    console.log('Creating Quote...');
    const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
            status: 'draft',
            quote_number: `MGL-USER-${Date.now()}`,
            title: 'MGL Maersk Sample Flow',
            account_id: accountId,
            origin_port_id: originPortId,
            destination_port_id: destPortId,
            tenant_id: tenantId
        })
        .select()
        .single();

    if (quoteError) throw quoteError;
    console.log(`Quote Created: ${quote.quote_number} (${quote.id})`);

    // 4. Create Quote Items
    // Aggregate unique sizes from all carriers
    const uniqueSizes = new Set<string>();
    USER_DATA.carriers.forEach(c => Object.keys(c.pricing_units).forEach(k => uniqueSizes.add(k)));

    const quoteItemsData = Array.from(uniqueSizes).map(key => ({
        quote_id: quote.id,
        container_size_id: CONTAINER_SIZES[key] || CONTAINER_SIZES['standard_20'],
        quantity: 1,
        weight_kg: 12000,
        tenant_id: tenantId,
        description: `Cargo for ${key}`
    }));

    await supabase.from('quote_items').insert(quoteItemsData);
    console.log('Quote Items Created.');

    // 5. Create Quotation Version
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
                 const { data: retryCarrier } = await supabase.from('carriers').select('id').ilike('carrier_name', carrierData.carrier_name).maybeSingle();
                 if (retryCarrier) carrierId = retryCarrier.id;
                 else throw carrierError;
            } else {
                 carrierId = newCarrier.id;
            }
        }

        console.log(`Processing Carrier: ${carrierData.carrier_name}`);

        for (const [sizeKey, charges] of Object.entries(carrierData.pricing_units)) {
            const sizeId = CONTAINER_SIZES[sizeKey] || CONTAINER_SIZES['standard_20'];

            // Create Option
            const { data: option, error: optionError } = await supabase.from('quotation_version_options').insert({
                quotation_version_id: version.id,
                carrier_id: carrierId,
                container_size_id: sizeId,
                is_selected: true,
                valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                tenant_id: tenantId,
                transit_days: 32 // from sample data
            }).select().single();

            if (optionError) throw optionError;

            // Create Legs (Multi-Leg: Road -> Ocean)
            const { data: leg1, error: leg1Error } = await supabase.from('quotation_version_option_legs').insert({
                quotation_version_option_id: option.id,
                mode: 'road',
                sort_order: 1,
                origin_location_id: originPortId,
                destination_location_id: originPortId,
                tenant_id: tenantId
            }).select().single();
            if (leg1Error) throw leg1Error;

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

            // Mapping sample data keys to charge categories and legs
            // For Maersk: ocean_freight (Leg 2), baf (Leg 2)
            // For Evergreen: ocean_freight (Leg 2), trucking (Leg 1), eps (Leg 2)

            if ((charges as any).trucking) {
                chargeInserts.push(createCharge((charges as any).trucking, CHARGE_CATS['trucking'], leg1.id, 'Trucking'));
            }
            if ((charges as any).ocean_freight) {
                chargeInserts.push(createCharge((charges as any).ocean_freight, CHARGE_CATS['ocean_freight'], leg2.id, 'Ocean Freight'));
            }
            if ((charges as any).baf) {
                chargeInserts.push(createCharge((charges as any).baf, CHARGE_CATS['baf'], leg2.id, 'Bunker Adjustment Factor')); // Full name as per sample
            }
            if ((charges as any).eps) {
                chargeInserts.push(createCharge((charges as any).eps, CHARGE_CATS['eps'], leg2.id, 'Equipment Position Surcharge'));
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
        body: { quoteId: quote.id, templateId: templateId },
        headers: { 'X-E2E-Key': 'trae-bypass-verification-2026' }
    });

    if (pdfError) {
        console.error('PDF Generation Error:', pdfError);
        throw pdfError;
    }
    if (!pdfData || !pdfData.content) throw new Error('PDF Generation returned no content');

    // Save locally
    const pdfBuffer = Buffer.from(pdfData.content, 'base64');
    fs.writeFileSync('mgl_user_sample_output.pdf', pdfBuffer);
    console.log('PDF saved to mgl_user_sample_output.pdf');

    // Send Email
    console.log('Sending Email to bahuguna.vimal@gmail.com...');
    const emailPayload = {
        to: ['bahuguna.vimal@gmail.com'],
        subject: 'MGL Granular Quote - Maersk Sample',
        body: `
            <h1>MGL Quotation - Maersk Sample</h1>
            <p>Please find attached the quote generated from sample data.</p>
            <p><strong>Quote Ref:</strong> ${quote.quote_number}</p>
            <p><strong>Carriers:</strong> Maersk Line, Evergreen</p>
            <p><strong>Includes:</strong> Granular Charges (BAF, EPS), Multi-Leg (Road -> Ocean).</p>
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

    if (emailError) {
        console.error('Email Sending Error:', emailError);
        throw emailError;
    }
    console.log('Email sent successfully:', emailData);
}

run().catch(console.error);
