
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const fs = require('fs');

// Helper to handle environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
  console.error('Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or SERVICE_ROLE_KEY) are set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  console.log('--- Starting E2E Quotation Test (Edge Function Integration) ---');

  // 1. Fetch Reference Data
  console.log('Fetching reference data...');
  const { data: ports, error: portsError } = await supabase.from('ports_locations').select('id, location_name').limit(5);
  if (portsError) throw new Error(`Error fetching ports: ${portsError.message}`);
  
  const { data: carriers, error: carriersError } = await supabase.from('carriers').select('id, carrier_name').limit(5);
  if (carriersError) throw new Error(`Error fetching carriers: ${carriersError.message}`);

  const { data: tenants, error: tenantsError } = await supabase.from('tenants').select('id, name').limit(1);
  const tenantId = tenants && tenants.length > 0 ? tenants[0].id : null;
  
  // Fetch Container Metadata
  const { data: cSizes } = await supabase.from('container_sizes').select('id, code, name').limit(10);
  const { data: cTypes } = await supabase.from('container_types').select('id, code, name').limit(10);
  const { data: pTypes } = await supabase.from('package_types').select('id, code, name').limit(10);
  
  // Fetch Template (Standard FCL)
  const { data: templates } = await supabase.from('quote_templates').select('id, name').eq('name', 'Standard FCL Quote').single();
  const templateId = templates ? templates.id : null;
  if (templateId) console.log(`Using Template: ${templates.name} (${templateId})`);
  else console.log('Using Default Template (Fallback)');

  // Fetch Currency (USD)
  const { data: currencies } = await supabase.from('currencies').select('id, code').eq('code', 'USD').single();
  const usdId = currencies ? currencies.id : null;

  // Fetch Charge Category (Freight)
  const { data: chgCats } = await supabase.from('charge_categories').select('id, name').ilike('name', '%Freight%').limit(1);
  const freightCatId = chgCats && chgCats.length > 0 ? chgCats[0].id : null;

  // Fetch Charge Side (Sell)
  const { data: chgSides } = await supabase.from('charge_sides').select('id, code').eq('code', 'sell').single();
  const sellSideId = chgSides ? chgSides.id : null;

  // Fetch Charge Basis (Container)
  const { data: chgBases } = await supabase.from('charge_bases').select('id, code').eq('code', 'container').single();
  const containerBasisId = chgBases ? chgBases.id : null;

  if (!ports || ports.length < 2) throw new Error('Not enough ports found (need at least 2)');
  const origin = ports[0];
  const dest = ports[1];
  const carrier = carriers && carriers[0] ? carriers[0] : { id: null, carrier_name: 'Test Carrier' };

  const size40HC = cSizes ? cSizes.find(s => s.code === '40_hc' || s.name.includes('40')) : null;
  const typeHC = cTypes ? cTypes.find(t => t.code === 'hc' || t.name.includes('High Cube')) : null;
  const sizeId = size40HC ? size40HC.id : (cSizes && cSizes[0] ? cSizes[0].id : null);
  const typeId = typeHC ? typeHC.id : (cTypes && cTypes[0] ? cTypes[0].id : null);

  const pkgPallet = pTypes ? pTypes.find(p => p.code.includes('PLT')) : null;
  const pkgId = pkgPallet ? pkgPallet.id : (pTypes && pTypes[0] ? pTypes[0].id : null);

  console.log(`Using Origin: ${origin.location_name}, Dest: ${dest.location_name}`);

  // ---------------------------------------------------------
  // CREATE QUOTE DATA
  // ---------------------------------------------------------
  console.log('\n--- Creating Multi-Leg Quote (System Data) ---');
  
  const multiQuoteNum = `MQ-${Date.now()}`;
  const quotePayload2 = {
    quote_number: multiQuoteNum,
    title: 'Multi-Leg Test',
    status: 'draft',
    origin_port_id: origin.id,
    destination_port_id: dest.id
  };
  if (tenantId) quotePayload2.tenant_id = tenantId;

  const { data: mq, error: mqError } = await supabase.from('quotes').insert(quotePayload2).select().single();
  if (mqError) throw new Error(`Failed to create Multi-Leg Quote: ${mqError.message}`);
  console.log(`Created Multi-Leg Quote: ${mq.quote_number} (ID: ${mq.id})`);

  // Items
  const itemPayload2 = [
    { quote_id: mq.id, container_size_id: sizeId, container_type_id: typeId, quantity: 1, line_number: 1, product_name: 'General Cargo', description: 'Test Goods', unit_price: 1000, line_total: 1000 },
  ];
  if (pkgId) itemPayload2[0].package_size_id = pkgId;

  const { error: itemsError2 } = await supabase.from('quote_items').insert(itemPayload2);
  if (itemsError2) console.warn('Items insert warning:', itemsError2.message);

  // Version
  const verPayload2 = { quote_id: mq.id, version_number: 1, status: 'draft' };
  if (tenantId) verPayload2.tenant_id = tenantId;
  const { data: mqVer, error: verError2 } = await supabase.from('quotation_versions').insert(verPayload2).select().single();
  if (verError2) throw verError2;

  // Option
  const optAPayload = {
    quotation_version_id: mqVer.id,
    carrier_id: carrier.id,
    total_amount: 4500,
    currency: 'USD',
    transit_days: 35,
    is_selected: true
  };
  if (tenantId) optAPayload.tenant_id = tenantId;
  if (usdId) optAPayload.quote_currency_id = usdId;

  const { data: optA, error: optAError } = await supabase.from('quotation_version_options').insert(optAPayload).select().single();
  if (optAError) throw optAError;

  // Charges
  const chargesA = [
      { name: 'Base Freight', amount: 3000 },
      { name: 'Trucking', amount: 1500 }
  ];
  for (const chg of chargesA) {
      const chgPayload = {
          quote_option_id: optA.id,
          amount: chg.amount,
          rate: chg.amount,
          quantity: 1,
          unit: 'Container',
          note: chg.name
      };
      if (tenantId) chgPayload.tenant_id = tenantId;
      if (usdId) chgPayload.currency_id = usdId;
      if (freightCatId) chgPayload.category_id = freightCatId;
      if (sellSideId) chgPayload.charge_side_id = sellSideId;
      if (containerBasisId) chgPayload.basis_id = containerBasisId;
      
      await supabase.from('quote_charges').insert(chgPayload);
  }

  // Legs
  const legsPayload = [
      { quotation_version_option_id: optA.id, sort_order: 1, mode: 'Road', origin_location_id: origin.id, destination_location_id: origin.id, transit_time_hours: 4 },
      { quotation_version_option_id: optA.id, sort_order: 2, mode: 'Ocean', origin_location_id: origin.id, destination_location_id: dest.id, transit_time_hours: 720, voyage_number: 'V123' },
      { quotation_version_option_id: optA.id, sort_order: 3, mode: 'Rail', origin_location_id: dest.id, destination_location_id: dest.id, transit_time_hours: 48 }
  ];
  if (tenantId) legsPayload.forEach(leg => leg.tenant_id = tenantId);
  await supabase.from('quotation_version_option_legs').insert(legsPayload);

  console.log('Multi-Leg Option setup complete.');

  // ---------------------------------------------------------
  // CALL GENERATE PDF EDGE FUNCTION
  // ---------------------------------------------------------
  console.log('\n--- Invoking Generate PDF Edge Function ---');
  
  const generateUrl = `${supabaseUrl}/functions/v1/generate-quote-pdf`;
  const generatePayload = {
      quoteId: mq.id,
      versionId: mqVer.id,
      templateId: templateId
  };

  let pdfBase64 = null;
  try {
      const response = await fetch(generateUrl, {
          method: 'POST',
          headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json'
          },
          body: JSON.stringify(generatePayload)
      });

      if (!response.ok) {
          const text = await response.text();
          throw new Error(`Generate Function failed (${response.status}): ${text}`);
      }

      const result = await response.json();
      pdfBase64 = result.content;
      console.log('PDF Generated via Edge Function.');

  } catch (err) {
      console.error('Generate Function Error:', err);
      process.exit(1);
  }

  // Validate PDF
  const pdfBuffer = Buffer.from(pdfBase64, 'base64');
  console.log(`PDF Size: ${pdfBuffer.length} bytes`);

  if (pdfBuffer.length < 100) {
      throw new Error('PDF size is suspiciously small');
  }

  const header = pdfBuffer.slice(0, 5).toString();
  if (header !== '%PDF-') {
      throw new Error(`Invalid PDF header: ${header}`);
  }

  // Save to disk for verification
  fs.writeFileSync('e2e_generated_quote_edge.pdf', pdfBuffer);
  console.log('Saved e2e_generated_quote_edge.pdf to disk.');

  // ---------------------------------------------------------
  // SEND EMAIL
  // ---------------------------------------------------------
  console.log('\n--- Sending Email via Edge Function ---');

  const targetEmail = 'bahuguna.vimal@gmail.com';
  
  const emailPayload = {
    to: targetEmail,
    subject: `Quotation Test (Edge): ${mq.quote_number}`,
    html: `
      <h2>Quotation ${mq.quote_number}</h2>
      <p>Dear Customer,</p>
      <p>Please find attached the quotation (Generated by Edge Function) for your review.</p>
      <p><b>Origin:</b> ${origin.location_name}</p>
      <p><b>Destination:</b> ${dest.location_name}</p>
      <br>
      <p>Best Regards,<br>Logistics Team</p>
    `,
    attachments: [
        { 
            filename: `Quotation_${mq.quote_number}.pdf`, 
            content: pdfBase64,
            type: 'application/pdf' 
        }
    ]
  };

  const emailUrl = `${supabaseUrl}/functions/v1/send-email`;
  
  try {
      const response = await fetch(emailUrl, {
          method: 'POST',
          headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json'
          },
          body: JSON.stringify(emailPayload)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Email Function Response (Success):', result);
      } else {
        const text = await response.text();
        console.log(`Email Function Response (Error ${response.status}):`, text);
      }
  } catch (err) {
      console.error('Email Function Invocation Failed:', err);
  }
  
  console.log('\n--- Test Completed ---');
}

runTest().catch(e => {
    console.error('Test Failed:', e);
    process.exit(1);
});
