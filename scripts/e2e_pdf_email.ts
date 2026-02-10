
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
  console.log('--- Starting E2E PDF & Email Verification (Production Flow) ---');

  try {
    // 1. Get Prerequisites
    const { data: ports } = await supabase.from('ports_locations').select('id, location_name').limit(2);
    const { data: account } = await supabase.from('accounts').select('id').limit(1).maybeSingle();
    const { data: tenant } = await supabase.from('tenants').select('id').limit(1).single();
    const { data: carriers } = await supabase.from('carriers').select('id').limit(1);

    if (!ports || ports.length < 2 || !account || !tenant) {
      throw new Error('Missing prerequisites (ports, account, or tenant)');
    }

    // 2. Create Quote
    console.log('Creating Quote...');
    const quotePayload = {
      tenant_id: tenant.id,
      account_id: account.id,
      origin_port_id: ports[0].id,
      destination_port_id: ports[1].id,
      status: 'draft',
      quote_number: `QUO-E2E-${Date.now()}`,
      title: 'E2E PDF Generation Test Quote',
      shipping_amount: 5000,
      currency: 'USD',
      cargo_details: {
          trade_direction: 'export',
          commodity: 'Test Goods',
          total_weight: 1000,
          total_volume: 10
      }
    };

    const { data: quote, error: qError } = await supabase
      .from('quotes')
      .insert(quotePayload)
      .select()
      .single();

    if (qError) throw qError;
    console.log(`Quote Created: ${quote.id} (${quote.quote_number})`);

    // 3. Create Version
    console.log('Creating Version...');
    const { data: version, error: vError } = await supabase
      .from('quotation_versions')
      .insert({
        quote_id: quote.id,
        tenant_id: tenant.id,
        version_number: 1,
        status: 'draft',
        // effective_date: new Date().toISOString(),
        // expiration_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();

    if (vError) throw vError;
    console.log(`Version Created: ${version.id}`);

    // 4. Create Option
    console.log('Creating Option...');
    const { data: option, error: oError } = await supabase
      .from('quotation_version_options')
      .insert({
        quotation_version_id: version.id,
        tenant_id: tenant.id,
        recommended: true,
        // is_primary: true,
        total_amount: 5000,
        currency: 'USD',
        transit_time: '25 days',
        carrier_id: carriers?.[0]?.id // Associate with carrier if available
      })
      .select()
      .single();

    if (oError) throw oError;
    console.log(`Option Created: ${option.id}`);

    // 4.1 Create Leg
    console.log('Creating Leg...');
    const { data: leg, error: lError } = await supabase
      .from('quotation_version_option_legs')
      .insert({
        tenant_id: tenant.id,
        quotation_version_option_id: option.id,
        sort_order: 1,
        transport_mode: 'air',
        origin_location_id: ports[0].id,
        destination_location_id: ports[1].id,
        flight_number: 'EK202',
        departure_date: new Date().toISOString(),
        arrival_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        transit_time_hours: 24
      })
      .select()
      .single();

    if (lError) throw lError;
    console.log(`Leg Created: ${leg.id}`);

    // 5. Generate PDF (Local Simulation)
    console.log('Generating PDF via Local Generator...');
    let pdfData;
    try {
        pdfData = await generatePdfLocal(quote.id, version.id);
    } catch (err: any) {
        throw new Error(`PDF Generation failed: ${err.message}`);
    }

    if (!pdfData || !pdfData.content) throw new Error('PDF Generation returned no content');
    
    console.log('PDF Generated successfully (Base64 length):', pdfData.content.length);

    // Write to file for visual inspection
    fs.writeFileSync('e2e_generated_quote.pdf', Buffer.from(pdfData.content, 'base64'));
    console.log('Saved to e2e_generated_quote.pdf');

    // 6. Send Email (Edge Function)
    console.log('Sending Email via Edge Function...');
    const recipient = 'bahuguna.vimal@gmail.com';
    const { data: emailData, error: emailError } = await invokeFunction('send-email', {
        body: {
            to: [recipient],
            subject: `E2E Test: Quote ${quote.quote_number}`,
            text: `Please find attached the quote ${quote.quote_number}.`,
            html: `<p>Please find attached the quote <strong>${quote.quote_number}</strong>.</p>`,
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

  } catch (error) {
    console.error('FAILED:', error);
    process.exit(1);
  }
}

main();
