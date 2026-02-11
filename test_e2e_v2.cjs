
const { createClient } = require('@supabase/supabase-js');
// const nodemailer = require('nodemailer'); // Not available in this environment
require('dotenv').config();

// console.log('Debug Env:');
// console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? 'Found' : 'Missing');
// console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Found' : 'Missing');
// console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Found' : 'Missing');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  console.log('--- Starting E2E Quotation Test ---');

  // 1. Fetch Reference Data
  console.log('Fetching reference data...');
  const { data: ports } = await supabase.from('ports_locations').select('id, location_name').limit(5);
  const { data: carriers } = await supabase.from('carriers').select('id, carrier_name').limit(5);
  
  if (!ports || ports.length < 2) throw new Error('Not enough ports found');
  const origin = ports[0];
  const dest = ports[1];
  const carrier = carriers && carriers[0] ? carriers[0] : { id: null, carrier_name: 'Test Carrier' };

  console.log(`Using Origin: ${origin.location_name}, Dest: ${dest.location_name}, Carrier: ${carrier.carrier_name}`);

  // ---------------------------------------------------------
  // SCENARIO 1: Quick Quote (Simulated Default Rates)
  // ---------------------------------------------------------
  console.log('\n--- Scenario 1: Quick Quote (Default Rates) ---');
  
  const quickQuoteNum = `QQ-${Date.now()}`;
  const { data: qq, error: qqError } = await supabase.from('quotes').insert({
    quote_number: quickQuoteNum,
    status: 'draft',
    origin_port_id: origin.id,
    destination_port_id: dest.id
    // freight_terms: 'Prepaid',
    // cargo_ready_date: new Date().toISOString()
  }).select().single();

  if (qqError) throw qqError;
  console.log(`Created Quick Quote: ${qq.id} (${qq.quote_number})`);

  // Add Item
  await supabase.from('quote_items').insert({
    quote_id: qq.id,
    container_size: '40',
    container_type: 'HC',
    quantity: 1,
    weight_kg: 12000
  });

  // Create Version
  const { data: qqVer } = await supabase.from('quotation_versions').insert({
    quote_id: qq.id,
    version_number: 1,
    status: 'draft'
  }).select().single();

  // Create Option with Breakdowns
  const breakdown1 = [
      { code: 'BAS', name: 'Base Freight', amount: 2500, currency: 'USD' },
      { code: 'BAF', name: 'Bunker Adj', amount: 150, currency: 'USD' },
      { code: 'THC', name: 'Terminal Handling', amount: 50, currency: 'USD' }
  ];
  
  await supabase.from('quotation_version_options').insert({
    quotation_version_id: qqVer.id,
    carrier_id: carrier.id,
    total_amount: 2700,
    currency: 'USD',
    transit_time_days: 25,
    valid_until: new Date(Date.now() + 86400000 * 30).toISOString(),
    charge_breakdown: breakdown1
  });
  
  console.log('Quick Quote Options & Breakdown inserted.');

  // ---------------------------------------------------------
  // SCENARIO 2: Multi-Mode/Multi-Leg (System Provided Data)
  // ---------------------------------------------------------
  console.log('\n--- Scenario 2: Multi-Mode/Multi-Leg Quote ---');

  const multiQuoteNum = `MQ-${Date.now()}`;
  const { data: mq, error: mqError } = await supabase.from('quotes').insert({
    quote_number: multiQuoteNum,
    status: 'draft',
    tenant_id: tenantId,
    origin_port_id: origin.id,
    destination_port_id: dest.id,
    // freight_terms: 'Collect',
    // cargo_ready_date: new Date().toISOString()
  }).select().single();

  if (mqError) throw mqError;
  console.log(`Created Multi Quote: ${mq.id} (${mq.quote_number})`);

  // Add Items (LCL)
  await supabase.from('quote_items').insert([
      { quote_id: mq.id, quantity: 10, package_type: 'Pallets', weight_kg: 5000, volume_cbm: 12 },
      { quote_id: mq.id, quantity: 5, package_type: 'Boxes', weight_kg: 200, volume_cbm: 1 }
  ]);

  // Create Version
  const { data: mqVer } = await supabase.from('quotation_versions').insert({
    quote_id: mq.id,
    version_number: 1,
    status: 'draft'
  }).select().single();

  // Create Option A: Ocean Multi-Leg
  const { data: optA } = await supabase.from('quotation_version_options').insert({
    quotation_version_id: mqVer.id,
    carrier_id: carrier.id,
    total_amount: 4500,
    currency: 'USD',
    transit_time_days: 35,
    is_selected: true,
    charge_breakdown: [
        { code: 'BAS', name: 'Base Freight', amount: 3000, currency: 'USD' },
        { code: 'P/U', name: 'Pickup', amount: 500, currency: 'USD' },
        { code: 'DEL', name: 'Delivery', amount: 1000, currency: 'USD' }
    ]
  }).select().single();

  // Insert Legs for Option A
  await supabase.from('quotation_version_option_legs').insert([
      { option_id: optA.id, sequence: 1, mode: 'Road', origin_location_id: origin.id, destination_location_id: origin.id, transit_time_hours: 4 },
      { option_id: optA.id, sequence: 2, mode: 'Ocean', origin_location_id: origin.id, destination_location_id: dest.id, transit_time_hours: 720, voyage_number: 'V123' },
      { option_id: optA.id, sequence: 3, mode: 'Rail', origin_location_id: dest.id, destination_location_id: dest.id, transit_time_hours: 48 }
  ]);

  console.log('Multi-Leg Option created with 3 legs (Road -> Ocean -> Rail).');

  // ---------------------------------------------------------
  // SIMULATE QUOTATION COMPOSER & EMAIL
  // ---------------------------------------------------------
  console.log('\n--- Simulating Quotation Generation & Email ---');

  const targetEmail = 'bahuguna.vimal@gmail.com';
  
  // 1. "Generate PDF" (Mock)
  console.log(`Generating PDF for Quote ${mq.id}...`);
  // In a real scenario, we would call the Edge Function.
  // const pdfRes = await fetch('.../generate-quote-pdf', ...);
  const mockPdfContent = 'VGhpcyBpcyBhIG1vY2sgUERGIGNvbnRlbnQgZm9yIHRlc3Rpbmcu'; // Base64 "This is a mock PDF..."

  // 2. "Send Email"
  console.log(`Attempting to send email to ${targetEmail}...`);
  
  // Check for SMTP credentials
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  /*
  if (smtpHost && smtpUser && smtpPass) {
      console.log('SMTP Credentials found. Sending via Nodemailer...');
      // Nodemailer is not installed in the root environment.
      // In production, this would be handled by the 'send-email' Edge Function.
  }
  */

  console.log('Logging simulated email payload (to be processed by send-email Edge Function):');
  console.log(JSON.stringify({
      to: targetEmail,
      subject: `Quotation Test: ${mq.quote_number}`,
      html: `<p>Please find attached the quotation <b>${mq.quote_number}</b> for your review.</p><p>Scenario: Multi-Leg/Multi-Mode.</p>`,
      attachments: [{ filename: `Quotation_${mq.quote_number}.pdf`, size: 'Mock Size', type: 'application/pdf' }]
  }, null, 2));
  console.log('NOTE: Email sending simulated. Use "supabase functions invoke send-email" to test actual delivery.');

  console.log('\n--- Test Completed Successfully ---');
}

runTest().catch(e => {
    console.error('Test Failed:', e);
    process.exit(1);
});
