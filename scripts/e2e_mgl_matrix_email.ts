
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

async function invokeFunction(functionName: string, options: any) {
  const { body } = options;
  const functionUrl = `${SUPABASE_URL}/functions/v1/${functionName}`;
  
  console.log(`Invoking ${functionName} at ${functionUrl}...`);
  
  try {
      const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_KEY}`
          },
          body: JSON.stringify(body)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
          return { data: null, error: { message: data.error || response.statusText, status: response.status } };
      }
      
      return { data, error: null };
  } catch (err: any) {
      return { data: null, error: { message: err.message } };
  }
}

async function main() {
  console.log('--- Starting E2E MGL Matrix Quote & Email Verification ---');

  try {
    // 1. Get Prerequisites
    console.log('Fetching prerequisites...');
    const { data: tenant } = await supabase.from('tenants').select('id').limit(1).single();
    if (!tenant) throw new Error('No tenant found');

    const { data: account } = await supabase.from('accounts').select('id, name').limit(1).maybeSingle();
    if (!account) throw new Error('No account found');

    const { data: ports } = await supabase.from('ports_locations').select('id, location_name').limit(2);
    if (!ports || ports.length < 2) throw new Error('Need at least 2 ports');

    // Fetch Carriers (Try to find specific ones, else fallback)
    const { data: carriers } = await supabase.from('carriers').select('id, carrier_name').in('carrier_name', ['Maersk', 'MSC', 'COSCO', 'ZIM', 'Evergreen']);
    let testCarriers = carriers || [];
    if (testCarriers.length < 3) {
        const { data: allCarriers } = await supabase.from('carriers').select('id, carrier_name').limit(3);
        testCarriers = allCarriers || [];
    }
    console.log(`Using Carriers: ${testCarriers.map(c => c.carrier_name).join(', ')}`);

    // Fetch Container Sizes/Types
    const { data: sizes } = await supabase.from('container_sizes').select('id, name');
    const { data: types } = await supabase.from('container_types').select('id, code, name');

    if (!sizes || sizes.length === 0) throw new Error('No container sizes found');
    if (!types || types.length === 0) throw new Error('No container types found');

    // Fetch MGL Template
    const { data: template } = await supabase.from('quote_templates').select('id, name').eq('name', 'MGL FCL Quote').single();
    if (!template) throw new Error('MGL FCL Quote template not found. Please run seed script.');
    console.log(`Using Template: ${template.name} (${template.id})`);

    // 2. Create Quote
    console.log('Creating Quote...');
    const quotePayload = {
      tenant_id: tenant.id,
      account_id: account.id,
      origin_port_id: ports[0].id,
      destination_port_id: ports[1].id,
      status: 'draft',
      quote_number: `MGL-E2E-${Date.now()}`,
      title: 'MGL Matrix E2E Test',
      shipping_amount: 0,
      currency: 'USD',
      cargo_details: {
          trade_direction: 'export',
          commodity: 'Electronic Goods',
          total_weight: 5000,
          total_volume: 30
      }
    };

    const { data: quote, error: qError } = await supabase.from('quotes').insert(quotePayload).select().single();
    if (qError) throw qError;
    console.log(`Quote Created: ${quote.id} (${quote.quote_number})`);

    // 2.1 Add Quote Items (for Shipment Details section)
    await supabase.from('quote_items').insert({
        quote_id: quote.id,
        container_size_id: sizes[0].id,
        container_type_id: types[0].id,
        quantity: 5,
        description: "Electronic Components"
    });

    // 3. Create Version
    console.log('Creating Version...');
    const { data: version, error: vError } = await supabase
      .from('quotation_versions')
      .insert({
        quote_id: quote.id,
        tenant_id: tenant.id,
        version_number: 1,
        status: 'draft',
        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();

    if (vError) throw vError;

    // 4. Create Options (The Matrix)
    console.log('Generating Matrix Options...');
    
    // Logic: 3 Carriers x (20' ST, 40' ST, 40' HC)
    // We'll filter sizes/types to ensure we have what we need
    const size20 = sizes.find(s => s.name.includes('20'));
    const size40 = sizes.find(s => s.name.includes('40'));
    // Relaxed matching for types
    const typeSt = types.find(t => ['GP', 'ST', 'DRY', 'Dry COC', 'Standard'].some(k => (t.code && t.code.includes(k)) || (t.name && t.name.includes(k))));
    const typeHc = types.find(t => ['HC', 'High Cube'].some(k => (t.code && t.code.includes(k)) || (t.name && t.name.includes(k))));

    const matrixConfig = [
        { size: size20, type: typeSt, base: 1000 },
        { size: size40, type: typeSt, base: 1800 },
        { size: size40, type: typeHc, base: 2000 }
    ];

    for (const carrier of testCarriers) {
        for (const config of matrixConfig) {
            if (!config.size || !config.type) continue;

            // Randomize price slightly
            const price = config.base + (Math.random() * 200);
            
            // Create Option
            const isAI = carrier.carrier_name === 'Maersk';
            const { data: option, error: oError } = await supabase
              .from('quotation_version_options')
              .insert({
                quotation_version_id: version.id,
                tenant_id: tenant.id,
                carrier_id: carrier.id,
                container_size_id: config.size.id,
                container_type_id: config.type.id,
                total_amount: price,
                currency: 'USD',
                transit_time: '25 days',
                // frequency: 'Weekly', // Column missing in DB
                // is_primary: false, // Column missing in DB
                is_selected: false,
                ai_generated: isAI,
                ai_explanation: isAI ? 'Rate predicted based on historical trends' : null
              })
              .select()
              .single();
            
            if (oError) {
                console.error('Error creating option:', oError);
                continue;
            }

            // Add Charges
            const charges = [
                { note: "Ocean Freight", amount: price * 0.8 },
                { note: "Bunker Surcharge", amount: price * 0.1 },
                { note: "Terminal Handling", amount: price * 0.1 }
            ];

            for (const chg of charges) {
                await supabase.from('quote_charges').insert({
                    quote_option_id: option.id,
                    tenant_id: tenant.id,
                    charge_name: chg.note,
                    amount: chg.amount,
                    currency: 'USD',
                    note: chg.note,
                    is_sell_charge: true
                });
            }
        }
    }
    console.log('Matrix Options Created.');

    // 5. Generate PDF (Local Simulation with MGL Layout)
    console.log('Generating PDF via Local Generator (MGL Matrix)...');
    let pdfData;
    try {
        // Pass template ID to trigger MGL layout
        pdfData = await generatePdfLocal(quote.id, version.id, template.id);
    } catch (err: any) {
        throw new Error(`PDF Generation failed: ${err.message}`);
    }

    if (!pdfData || !pdfData.content) throw new Error('PDF Generation returned no content');
    
    console.log('PDF Generated successfully (Base64 length):', pdfData.content.length);

    // Write to file for visual inspection
    const filename = `mgl_quote_${quote.quote_number}.pdf`;
    fs.writeFileSync(filename, Buffer.from(pdfData.content, 'base64'));
    console.log(`Saved to ${filename}`);

    // 6. Send Email (Edge Function)
    console.log('Sending Email via Edge Function...');
    const recipient = 'bahuguna.vimal@gmail.com';
    const { data: emailData, error: emailError } = await invokeFunction('send-email', {
        body: {
            to: [recipient],
            subject: `MGL Matrix Quote: ${quote.quote_number}`,
            text: `Dear Customer,\n\nPlease find attached the quotation ${quote.quote_number} from Miami Global Lines.\n\nBest Regards,\nMGL Team`,
            html: `<p>Dear Customer,</p><p>Please find attached the quotation <strong>${quote.quote_number}</strong> from Miami Global Lines.</p><br/><p>Best Regards,<br/>MGL Team</p>`,
            attachments: [
                {
                    filename: `Quote-${quote.quote_number}.pdf`,
                    content: pdfData.content,
                    encoding: 'base64',
                    contentType: 'application/pdf'
                }
            ]
        }
    });

    if (emailError) throw new Error(`Email sending failed: ${emailError.message}`);
    console.log('Email sent successfully:', emailData);
    console.log('--- E2E Test Completed Successfully ---');

  } catch (error) {
    console.error('FAILED:', error);
    process.exit(1);
  }
}

main();
