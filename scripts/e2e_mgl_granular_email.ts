
import { createClient } from '@supabase/supabase-js';
import { generatePdfLocal } from './local_pdf_generator.ts';
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

async function runE2E() {
    console.log('Starting E2E MGL Granular Quote Test...');

    // 1. Get Template
    const { data: template, error: tmplError } = await supabase
        .from('quote_templates')
        .select('*')
        .eq('name', 'MGL Granular Quote')
        .single();
    
    if (tmplError) throw new Error(`Template not found: ${tmplError.message}`);
    console.log(`Using Template: ${template.name} (${template.id})`);

    // 2. Create Quote
    // Fetch prerequisites
    const { data: tenant } = await supabase.from('tenants').select('id').limit(1).single();
    const tenantId = tenant?.id; // Might be null if no tenant, but usually required.

    const { data: accounts } = await supabase.from('accounts').select('id').limit(1);
    const accountId = accounts?.[0]?.id;

    const { data: ports } = await supabase.from('ports_locations').select('id').limit(2);
    const originId = ports?.[0]?.id;
    const destId = ports?.[1]?.id;

    if (!originId || !destId || !accountId) {
        throw new Error("Could not fetch required FKs (ports/account)");
    }

    const { data: validQuote, error: validQuoteError } = await supabase
        .from('quotes')
        .insert({
            status: 'draft',
            quote_number: `QT-GRANULAR-${Date.now()}`,
            title: 'MGL Granular E2E Test',
            account_id: accountId,
            origin_port_id: originId,
            destination_port_id: destId,
            tenant_id: tenantId
        })
        .select()
        .single();
    
    if (validQuoteError) throw new Error(`Quote creation failed: ${validQuoteError.message}`);
    console.log(`Quote Created: ${validQuote.id}`);

    // 3. Create Version
    const { data: version, error: verError } = await supabase
        .from('quotation_versions')
        .insert({
            quote_id: validQuote.id,
            version_number: 1,
            tenant_id: tenantId,
            status: 'draft',
            valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        })
        .select()
        .single();

    if (verError) throw new Error(`Version creation failed: ${verError.message}`);
    console.log(`Version Created: ${version.id}`);

    // 4. Create Option (Multi-Leg)
    // We need container sizes.
    const { data: sizes } = await supabase.from('container_sizes').select('id, name').limit(2);
    const size20 = sizes?.find(s => s.name.includes('20')) || sizes?.[0];
    const size40 = sizes?.find(s => s.name.includes('40')) || sizes?.[1];

    if (!size20 || !size40) throw new Error("Could not find container sizes");

    const carrierName = "ZIM";
    const { data: carrier } = await supabase.from('carriers').select('id').eq('carrier_name', carrierName).single();
    const carrierId = carrier?.id;

    // Option 1: 20' Container
    const { data: opt1, error: opt1Error } = await supabase
        .from('quotation_version_options')
        .insert({
            quotation_version_id: version.id,
            carrier_id: carrierId, // might be null if not found, that's ok for some schemas
            container_size_id: size20.id,
            total_amount: 1500,
            currency: 'USD',
            transit_time: '25 days',
            is_selected: true,
            tenant_id: tenantId
        })
        .select()
        .single();
    
    if (opt1Error) throw new Error(`Option 1 creation failed: ${opt1Error.message}`);
    console.log(`Option 1 Created: ${opt1.id}`);

    // 5. Create Legs for Option 1
    // Leg 1: Truck Pickup
    // Leg 2: Ocean Freight
    // 5. Create Legs for Option 1
    const legsPayload = [
        {
            quotation_version_option_id: opt1.id,
            sort_order: 1,
            mode: 'road',
            origin_location: 'Warehouse A',
            destination_location: 'Port of Miami',
            tenant_id: tenantId
        },
        {
            quotation_version_option_id: opt1.id,
            sort_order: 2,
            mode: 'ocean',
            origin_location: 'Port of Miami',
            destination_location: 'Port of Felixstowe',
            tenant_id: tenantId
        },
        {
            quotation_version_option_id: opt1.id,
            sort_order: 3,
            mode: 'road',
            origin_location: 'Port of Felixstowe',
            destination_location: 'Warehouse B',
            tenant_id: tenantId
        }
    ];

    const { data: legs, error: legsError } = await supabase
        .from('quotation_version_option_legs')
        .insert(legsPayload)
        .select();

    if (legsError) throw new Error(`Legs creation failed: ${legsError.message}`);
    console.log(`Created ${legs?.length} legs for Option 1`);
    console.log('Legs:', JSON.stringify(legs, null, 2));

    const leg1 = legs.find(l => l.sort_order === 1 || l.sort_order === 100);
    const leg2 = legs.find(l => l.sort_order === 2);
    const leg3 = legs.find(l => l.sort_order === 3);

    // Fetch Charge Sides
    const { data: chargeSides } = await supabase.from('charge_sides').select('id, code').limit(10);
    const sellSide = chargeSides?.find(s => s.code === 'SELL') || chargeSides?.[0];
    if (!sellSide) throw new Error('No charge sides found');

    // Fetch Charge Categories
    const { data: chargeCategories } = await supabase.from('charge_categories').select('id, code').limit(20);
    if (!chargeCategories || chargeCategories.length === 0) throw new Error('No charge categories found');
    
    const freightCat = chargeCategories.find(c => c.code === 'FREIGHT' || c.code === 'OCEAN_FREIGHT') || chargeCategories[0];
    const originCat = chargeCategories.find(c => c.code === 'ORIGIN' || c.code === 'PICKUP') || freightCat;
    const destCat = chargeCategories.find(c => c.code === 'DESTINATION' || c.code === 'DELIVERY') || freightCat;
    const docCat = chargeCategories.find(c => c.code === 'DOCUMENTATION' || c.code === 'FEES') || freightCat;

    // Fetch Charge Bases
    const { data: chargeBases } = await supabase.from('charge_bases').select('id, code').limit(20);
    if (!chargeBases || chargeBases.length === 0) throw new Error('No charge bases found');
    
    const containerBasis = chargeBases.find(b => b.code === 'PER_CONTAINER' || b.code === 'CONTAINER') || chargeBases[0];
    const blBasis = chargeBases.find(b => b.code === 'PER_BL' || b.code === 'PER_SHIPMENT' || b.code === 'SHIPMENT') || containerBasis;

    // 6. Create Charges linked to Legs
    // Leg 1 Charge: Pickup
    // Leg 2 Charge: Ocean Freight
    // Leg 3 Charge: Delivery
    // General Charge: Doc Fee
    const chargesPayload = [
        {
            quote_option_id: opt1.id,
            leg_id: leg1?.id,
            // charge_name: 'Pickup Trucking', // Removed: column does not exist
            amount: 300,
            currency_id: null, // Placeholder or fetch real currency if needed. 'USD' string will fail if column is UUID.
            unit: 'per_container', // Changed from unit_type
            // is_included: true, // check if column exists
            note: 'Pickup Trucking',
            tenant_id: tenantId,
            charge_side_id: sellSide.id,
            category_id: originCat.id,
            basis_id: containerBasis.id
        },
        {
            quote_option_id: opt1.id,
            leg_id: leg2?.id,
            // charge_name: 'Ocean Freight',
            amount: 1000,
            currency_id: null,
            unit: 'per_container',
            // is_included: true,
            note: 'Ocean Freight',
            tenant_id: tenantId,
            charge_side_id: sellSide.id,
            category_id: freightCat.id,
            basis_id: containerBasis.id
        },
        {
            quote_option_id: opt1.id,
            leg_id: leg3?.id,
            // charge_name: 'Delivery Trucking',
            amount: 300,
            currency_id: null,
            unit: 'per_container',
            // is_included: true,
            note: 'Delivery Trucking',
            tenant_id: tenantId,
            charge_side_id: sellSide.id,
            category_id: destCat.id,
            basis_id: containerBasis.id
        },
        {
            quote_option_id: opt1.id,
            leg_id: leg2?.id, // General charge attached to Ocean Leg
            // charge_name: 'Documentation Fee',
            amount: 50,
            currency_id: null,
            unit: 'per_bl',
            // is_included: true,
            note: 'Documentation Fee',
            tenant_id: tenantId,
            charge_side_id: sellSide.id,
            category_id: docCat.id,
            basis_id: blBasis.id
        }
    ];

    const { error: chgError } = await supabase
        .from('quote_charges')
        .insert(chargesPayload);

    if (chgError) throw new Error(`Charges creation failed: ${chgError.message}`);
    console.log('Charges created');

    // Option 2: 40' Container (Similar structure)
    // For brevity, we'll just duplicate the structure but with higher prices
    const { data: opt2 } = await supabase
        .from('quotation_version_options')
        .insert({
            quotation_version_id: version.id,
            carrier_id: carrierId,
            container_size_id: size40.id,
            total_amount: 2500,
            currency: 'USD',
            transit_time: '25 days',
            is_selected: true,
            tenant_id: tenantId
        })
        .select()
        .single();

    // Re-create legs for opt2 (must be new records)
    const legsPayload2 = legsPayload.map(l => ({ ...l, quotation_version_option_id: opt2.id }));
    const { data: legs2 } = await supabase.from('quotation_version_option_legs').insert(legsPayload2).select();

    if (!legs2) throw new Error("Failed to create legs for option 2");

    const leg2_1 = legs2.find(l => l.sort_order === 1 || l.sort_order === 100);
    const leg2_2 = legs2.find(l => l.sort_order === 2);
    const leg2_3 = legs2.find(l => l.sort_order === 3);

    const chargesPayload2 = [
        {
            quote_option_id: opt2.id,
            leg_id: leg2_1?.id,
            // charge_name: 'Pickup Trucking',
            amount: 450, // Higher for 40'
            currency_id: null,
            note: 'Pickup Trucking',
            tenant_id: tenantId,
            charge_side_id: sellSide.id,
            category_id: originCat.id,
            basis_id: containerBasis.id
        },
        {
            quote_option_id: opt2.id,
            leg_id: leg2_2?.id,
            // charge_name: 'Ocean Freight',
            amount: 1800,
            currency_id: null,
            note: 'Ocean Freight',
            tenant_id: tenantId,
            charge_side_id: sellSide.id,
            category_id: freightCat.id,
            basis_id: containerBasis.id
        },
        {
            quote_option_id: opt2.id,
            leg_id: leg2_3?.id,
            // charge_name: 'Delivery Trucking',
            amount: 450,
            currency_id: null,
            note: 'Delivery Trucking',
            tenant_id: tenantId,
            charge_side_id: sellSide.id,
            category_id: destCat.id,
            basis_id: containerBasis.id
        },
        {
            quote_option_id: opt2.id,
            leg_id: leg2_2?.id,
            // charge_name: 'Documentation Fee',
            amount: 50,
            currency_id: null,
            note: 'Documentation Fee',
            tenant_id: tenantId,
            charge_side_id: sellSide.id,
            category_id: docCat.id,
            basis_id: blBasis.id
        }
    ];
    await supabase.from('quote_charges').insert(chargesPayload2);
    console.log('Option 2 created');


    // 7. Generate PDF Locally for Verification
    console.log('Generating PDF Locally...');
    await generatePdfLocal(validQuote.id, version.id, template.id);
    console.log('PDF generated locally: mgl_granular_test.pdf');

    // 8. Send Email (using Edge Function)
    console.log('Sending Email...');
    const emailPayload = {
        to: ['bahuguna.vimal@gmail.com'],
        subject: 'MGL Granular Quote Test',
        body: 'Please find attached the granular quote.',
        quote_id: validQuote.id,
        version_id: version.id,
        template_id: template.id
    };

    const { data: funcData, error: funcError } = await supabase.functions.invoke('send-email', {
        body: emailPayload
    });

    if (funcError) {
        console.error('Email sending failed:', funcError);
    } else {
        console.log('Email sent successfully:', funcData);
    }
}

runE2E().catch(console.error);
