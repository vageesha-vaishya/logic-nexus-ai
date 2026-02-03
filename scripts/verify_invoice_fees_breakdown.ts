
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env explicitly
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseKey) {
  console.error('ERROR: Supabase Key is missing from .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyInvoiceFeesBreakdown() {
  console.log('Verifying Invoice Fees Breakdown Metadata...');

  // 1. Get a valid tenant
  const { data: { user }, error: authError } = await supabase.auth.getUser(); // Usually null in scripts unless signed in
  // For script, we might need to bypass RLS or use a known tenant if we can't sign in.
  // Actually, calculate_duty is SECURITY DEFINER, create_invoice_from_shipment is SECURITY DEFINER.
  // But we need a valid tenant_id to pass.
  
  // Let's pick a random tenant from tenants table if possible, or use a hardcoded UUID if we know one.
  // Better: Create a dummy shipment.
  
  // Actually, to create a shipment we need a tenant.
  // Let's try to find a tenant first.
  const { data: tenants } = await supabase.from('tenants').select('id').limit(1);
  const tenantId = tenants?.[0]?.id;

  if (!tenantId) {
    console.error('No tenant found. Cannot run test.');
    return;
  }
  console.log('Using Tenant ID:', tenantId);

  // 2. Create a dummy customer (or find one)
  const { data: customers } = await supabase.from('accounts').select('id').eq('tenant_id', tenantId).limit(1);
  let customerId = customers?.[0]?.id;
  
  if (!customerId) {
     // Create one
     const { data: newCust, error: custError } = await supabase.from('accounts').insert({
       tenant_id: tenantId,
       name: 'Test Customer for Fees',
       type: 'customer'
     }).select().single();
     if (custError) {
        console.error('Error creating customer:', custError);
        return;
     }
     customerId = newCust.id;
  }

  // 3. Create a dummy shipment (Ocean, US Destination)
  const { data: shipment, error: shipError } = await supabase.from('shipments').insert({
    tenant_id: tenantId,
    account_id: customerId,
    shipment_number: 'SHP-TEST-FEES-' + Date.now(),
    status: 'draft',
    shipment_type: 'ocean_freight',
    origin_address: { country: 'CN' },
    destination_address: { country: 'US' },
    origin_country: 'CN',
    destination_country: 'US',
    currency: 'USD'
  }).select().single();

  if (shipError) {
    console.error('Error creating shipment:', shipError);
    return;
  }
  console.log('Created Shipment:', shipment.id);

  // 4. Add Cargo Item (triggers MPF/HMF)
  // Need valid HTS code ID.
  const { data: htsData } = await supabase.from('aes_hts_codes').select('id, hts_code').limit(1);
  if (!htsData || htsData.length === 0) {
      console.error('No HTS codes found.');
      return;
  }
  const htsId = htsData[0].id;
  console.log('Using HTS:', htsData[0].hts_code);

  const { error: cargoError } = await supabase.from('cargo_details').insert({
    tenant_id: tenantId,
    service_id: shipment.id,
    service_type: 'shipment',
    aes_hts_id: htsId,
    value_amount: 10000, // $10,000 value
    value_currency: 'USD',
    package_count: 10,
    weight_kg: 100
  });

  if (cargoError) {
    console.error('Error adding cargo:', cargoError);
    return;
  }

  // 5. Call create_invoice_from_shipment
  console.log('Generating Invoice...');
  const { data: invoiceId, error: invError } = await supabase.rpc('create_invoice_from_shipment', {
    p_shipment_id: shipment.id,
    p_tenant_id: tenantId
  });

  if (invError) {
    console.error('Error generating invoice:', invError);
    return;
  }
  console.log('Generated Invoice ID:', invoiceId);

  // 6. Inspect Line Items
  const { data: lines, error: linesError } = await supabase.from('invoice_line_items')
    .select('*')
    .eq('invoice_id', invoiceId);

  if (linesError) {
    console.error('Error fetching lines:', linesError);
    return;
  }

  // Find fees line
  console.log('All lines:', JSON.stringify(lines, null, 2));
  const feesLine = lines.find(l => l.type === 'fees' || l.description === 'Customs Duties & Fees');
  
  if (feesLine) {
    console.log('Found Fees Line:', feesLine.description);
    console.log('Metadata:', JSON.stringify(feesLine.metadata, null, 2));

    const metadata = feesLine.metadata as any;
    if (metadata.mpf_amount && metadata.hmf_amount && metadata.duty_amount) {
      console.log('SUCCESS: mpf_amount, hmf_amount, and duty_amount are present in metadata.');
      console.log(`Duty: ${metadata.duty_amount}, MPF: ${metadata.mpf_amount}, HMF: ${metadata.hmf_amount}`);
      console.log(`Unit Price: ${feesLine.unit_price}`);
      const total = Number(metadata.duty_amount) + Number(metadata.mpf_amount) + Number(metadata.hmf_amount);
      if (Math.abs(total - feesLine.unit_price) < 0.01) {
          console.log('SUCCESS: Unit Price matches total of breakdown.');
      } else {
          console.error(`FAILURE: Unit Price ${feesLine.unit_price} does not match total ${total}`);
      }
    } else {
      console.error('FAILURE: Missing metadata fields');
    }
  } else {
    console.error('FAILURE: Fees line not found.');
    // Check if total fees were 0?
    // 10000 * 0.003464 = 34.64 MPF
    // 10000 * 0.00125 = 12.50 HMF
    // Should be > 0.
  }
  
  // Cleanup?
  // Maybe leave it for inspection or manual cleanup.
}

verifyInvoiceFeesBreakdown().catch(console.error);
