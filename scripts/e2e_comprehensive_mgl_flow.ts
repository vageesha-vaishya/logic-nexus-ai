
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

async function runComprehensiveE2E() {
    console.log('Starting Comprehensive MGL Quote E2E Test...');

    // 1. Get Template (MGL Granular)
    const { data: template, error: tmplError } = await supabase
        .from('quote_templates')
        .select('*')
        .eq('name', 'MGL Granular Quote')
        .single();
    
    if (tmplError) throw new Error(`Template not found: ${tmplError.message}`);
    console.log(`Using Template: ${template.name} (${template.id})`);

    // 2. Setup Prerequisites (Tenant, Account, Ports, Carriers)
    const { data: tenant } = await supabase.from('tenants').select('id').limit(1).single();
    const tenantId = tenant?.id;

    const { data: accounts } = await supabase.from('accounts').select('id').limit(1);
    const accountId = accounts?.[0]?.id;

    // Need at least 3 ports for complex route
    const { data: ports } = await supabase.from('ports_locations').select('id, location_name').limit(5);
    if (!ports || ports.length < 3) throw new Error("Need at least 3 ports");
    const portA = ports[0];
    const portB = ports[1];
    const portC = ports[2];

    const { data: sizes } = await supabase.from('container_sizes').select('id, name').limit(2);
    if (!sizes || sizes.length === 0) throw new Error("No container sizes found");
    const size20 = sizes.find(s => s.name.includes('20')) || sizes[0];
    const size40 = sizes.find(s => s.name.includes('40')) || sizes[1] || sizes[0];

    const { data: carriers } = await supabase.from('carriers').select('id, carrier_name').limit(2);
    if (!carriers || carriers.length === 0) throw new Error("No carriers found");
    const carrier1 = carriers[0];
    const carrier2 = carriers[1] || carriers[0];

    // Charge Metadata
    const { data: chargeSides } = await supabase.from('charge_sides').select('id, code').limit(10);
    const sellSide = chargeSides?.find(s => s.code === 'SELL') || chargeSides?.[0];

    const { data: chargeCategories } = await supabase.from('charge_categories').select('id, code').limit(20);
    const freightCat = chargeCategories?.find(c => c.code === 'FREIGHT' || c.code === 'OCEAN_FREIGHT') || chargeCategories?.[0];
    const originCat = chargeCategories?.find(c => c.code === 'ORIGIN' || c.code === 'PICKUP') || freightCat;
    const destCat = chargeCategories?.find(c => c.code === 'DESTINATION' || c.code === 'DELIVERY') || freightCat;
    const docCat = chargeCategories?.find(c => c.code === 'DOCUMENTATION' || c.code === 'FEES') || freightCat;

    const { data: chargeBases } = await supabase.from('charge_bases').select('id, code').limit(20);
    const containerBasis = chargeBases?.find(b => b.code === 'PER_CONTAINER' || b.code === 'CONTAINER') || chargeBases?.[0];
    const blBasis = chargeBases?.find(b => b.code === 'PER_BL' || b.code === 'SHIPMENT') || containerBasis;

    if (!tenantId || !accountId || !size20 || !carrier1 || !sellSide || !freightCat) {
        throw new Error("Missing prerequisites (FKs)");
    }

    // 3. Create Quote (Multi-Mode Scenario)
    const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
            status: 'draft',
            quote_number: `COMPLEX-${Date.now()}`,
            title: 'MGL Complex E2E',
            account_id: accountId,
            origin_port_id: portA.id,
            destination_port_id: portC.id,
            tenant_id: tenantId
        })
        .select()
        .single();
    
    if (quoteError) throw new Error(`Quote creation failed: ${quoteError.message}`);
    console.log(`Quote Created: ${quote.quote_number} (${quote.id})`);

    // 4. Create Quote Items
    await supabase.from('quote_items').insert([
        { quote_id: quote.id, container_size: size20.id, quantity: 2, weight_kg: 15000, tenant_id: tenantId, description: 'Electronics & Parts' },
        { quote_id: quote.id, container_size: size40.id, quantity: 1, weight_kg: 22000, tenant_id: tenantId, description: 'Electronics & Parts' }
    ]);

    // 5. Create Version
    const { data: version, error: verError } = await supabase
        .from('quotation_versions')
        .insert({
            quote_id: quote.id,
            version_number: 1,
            tenant_id: tenantId,
            status: 'draft',
            valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        })
        .select()
        .single();
    if (verError) throw new Error(`Version failed: ${verError.message}`);

    // 6. Create Option 1: Carrier 1, 20' Container, 3 Legs (Truck -> Ocean -> Truck)
    const { data: opt1 } = await supabase
        .from('quotation_version_options')
        .insert({
            quotation_version_id: version.id,
            carrier_id: carrier1.id,
            container_size_id: size20.id,
            total_amount: 0, // Will calculate later
            currency: 'USD',
            transit_time: '32 days',
            is_selected: true,
            tenant_id: tenantId
        })
        .select()
        .single();

    if (!opt1) throw new Error("Option 1 creation failed");

    // Legs for Option 1
    const legsPayload = [
        {
            quotation_version_option_id: opt1.id,
            sort_order: 1,
            mode: 'road',
            origin_location_id: portA.id, // Using IDs now
            destination_location_id: portB.id,
            tenant_id: tenantId,
            origin_location: portA.location_name, // Fallback text
            destination_location: portB.location_name
        },
        {
            quotation_version_option_id: opt1.id,
            sort_order: 2,
            mode: 'ocean',
            origin_location_id: portB.id,
            destination_location_id: portC.id, // Direct ocean for simplicity in this leg
            tenant_id: tenantId,
            origin_location: portB.location_name,
            destination_location: portC.location_name
        }
    ];

    const { data: legs } = await supabase.from('quotation_version_option_legs').insert(legsPayload).select();
    if (!legs) throw new Error("Legs creation failed");
    
    const leg1 = legs.find(l => l.sort_order === 1);
    const leg2 = legs.find(l => l.sort_order === 2);

    // Charges for Option 1
    const chargesPayload = [
        {
            quote_option_id: opt1.id,
            leg_id: leg1?.id,
            amount: 450,
            unit: 'per_container',
            note: 'Pickup Trucking',
            tenant_id: tenantId,
            charge_side_id: sellSide.id,
            category_id: originCat?.id,
            basis_id: containerBasis?.id
        },
        {
            quote_option_id: opt1.id,
            leg_id: leg2?.id,
            amount: 1250,
            unit: 'per_container',
            note: 'Ocean Freight',
            tenant_id: tenantId,
            charge_side_id: sellSide.id,
            category_id: freightCat?.id,
            basis_id: containerBasis?.id
        },
        {
            quote_option_id: opt1.id,
            leg_id: null, // General Charge
            amount: 75,
            unit: 'per_bl',
            note: 'Documentation Fee',
            tenant_id: tenantId,
            charge_side_id: sellSide.id,
            category_id: docCat?.id,
            basis_id: blBasis?.id
        }
    ];
    await supabase.from('quote_charges').insert(chargesPayload);

    // Update total amount for Opt 1
    await supabase.from('quotation_version_options').update({ total_amount: 450 + 1250 + 75 }).eq('id', opt1.id);


    // 7. Create Option 2: Carrier 2, 40' Container, Same Legs
    const { data: opt2 } = await supabase
        .from('quotation_version_options')
        .insert({
            quotation_version_id: version.id,
            carrier_id: carrier2.id,
            container_size_id: size40.id,
            total_amount: 0,
            currency: 'USD',
            transit_time: '35 days',
            is_selected: false,
            tenant_id: tenantId
        })
        .select()
        .single();
    
    // Duplicate legs for Opt 2
    const legsPayload2 = legsPayload.map(l => ({ ...l, quotation_version_option_id: opt2.id }));
    const { data: legs2 } = await supabase.from('quotation_version_option_legs').insert(legsPayload2).select();
    const leg2_1 = legs2?.find(l => l.sort_order === 1);
    const leg2_2 = legs2?.find(l => l.sort_order === 2);

    const chargesPayload2 = [
        {
            quote_option_id: opt2.id,
            leg_id: leg2_1?.id,
            amount: 600, // Higher for 40'
            unit: 'per_container',
            note: 'Pickup Trucking',
            tenant_id: tenantId,
            charge_side_id: sellSide.id,
            category_id: originCat?.id,
            basis_id: containerBasis?.id
        },
        {
            quote_option_id: opt2.id,
            leg_id: leg2_2?.id,
            amount: 2100,
            unit: 'per_container',
            note: 'Ocean Freight',
            tenant_id: tenantId,
            charge_side_id: sellSide.id,
            category_id: freightCat?.id,
            basis_id: containerBasis?.id
        },
        {
            quote_option_id: opt2.id,
            leg_id: null,
            amount: 75,
            unit: 'per_bl',
            note: 'Documentation Fee',
            tenant_id: tenantId,
            charge_side_id: sellSide.id,
            category_id: docCat?.id,
            basis_id: blBasis?.id
        }
    ];
    await supabase.from('quote_charges').insert(chargesPayload2);
    await supabase.from('quotation_version_options').update({ total_amount: 600 + 2100 + 75 }).eq('id', opt2.id);

    console.log('Complex Quote Data Created Successfully.');

    // 8. Generate PDF via Edge Function
    console.log('Invoking generate-quote-pdf...');
    const { data: pdfData, error: pdfError } = await supabase.functions.invoke('generate-quote-pdf', {
        body: {
            quoteId: quote.id,
            versionId: version.id,
            templateId: template.id
        }
    });

    if (pdfError) throw new Error(`PDF Generation failed: ${pdfError.message}`);
    if (!pdfData?.content) throw new Error("PDF Generation returned empty content");

    console.log('PDF Generated. Saving locally for verification...');
    const buffer = Buffer.from(pdfData.content, 'base64');
    fs.writeFileSync('comprehensive_test_output.pdf', buffer);
    console.log('Saved to comprehensive_test_output.pdf');

    // 9. Send Email WITH ATTACHMENT
    console.log('Sending Email to bahuguna.vimal@gmail.com...');
    const emailPayload = {
        to: ['bahuguna.vimal@gmail.com'],
        subject: 'MGL Granular Quote (Comprehensive E2E)',
        body: `
            <h1>MGL Quotation</h1>
            <p>Please find attached the complex multi-option quote.</p>
            <p><strong>Quote Ref:</strong> ${quote.quote_number}</p>
            <p><strong>Scenario:</strong> Multi-Mode (Road/Ocean), Multi-Option (20'/40', different carriers), Granular Charges.</p>
        `,
        provider: 'resend', // Force resend (system) to ensure delivery
        attachments: [
            {
                filename: `Quote_${quote.quote_number}.pdf`,
                content: pdfData.content,
                contentType: 'application/pdf'
            }
        ]
    };

    const { data: emailData, error: emailError } = await supabase.functions.invoke('send-email', {
        body: emailPayload
    });

    if (emailError) {
        console.error('Email sending failed:', emailError);
    } else {
        console.log('Email sent successfully:', emailData);
    }
}

runComprehensiveE2E().catch(console.error);
