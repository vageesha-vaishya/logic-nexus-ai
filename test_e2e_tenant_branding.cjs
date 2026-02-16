const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function ensureBrandingTenant() {
  const { data: tenants, error: tenantsError } = await supabase.from('tenants').select('id, name').limit(1);
  if (tenantsError || !tenants || tenants.length === 0) {
    throw new Error(`Error fetching tenant for branding test: ${tenantsError ? tenantsError.message : 'no tenants found'}`);
  }
  const tenantId = tenants[0].id;

  const companyName = 'Branding Test Tenant';

  const { data: existingBranding } = await supabase
    .from('tenant_branding')
    .select('id, company_name')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (existingBranding && existingBranding.company_name === companyName) {
    return tenantId;
  }

  const payload = {
    tenant_id: tenantId,
    company_name: companyName
  };

  if (existingBranding) {
    const { error: updateError } = await supabase
      .from('tenant_branding')
      .update(payload)
      .eq('id', existingBranding.id);
    if (updateError) {
      throw new Error(`Failed to update tenant_branding: ${updateError.message}`);
    }
  } else {
    const { error: insertError } = await supabase
      .from('tenant_branding')
      .insert(payload);
    if (insertError) {
      throw new Error(`Failed to insert tenant_branding: ${insertError.message}`);
    }
  }

  return tenantId;
}

async function createBrandedQuote(tenantId) {
  const { data: ports, error: portsError } = await supabase
    .from('ports_locations')
    .select('id, location_name')
    .limit(2);
  if (portsError) throw new Error(`Error fetching ports: ${portsError.message}`);
  if (!ports || ports.length < 2) throw new Error('Not enough ports found for branded quote (need at least 2)');

  const origin = ports[0];
  const dest = ports[1];

  const quoteNumber = `BRAND-${Date.now()}`;
  const quotePayload = {
    quote_number: quoteNumber,
    title: 'Branding Test Quote',
    status: 'draft',
    origin_port_id: origin.id,
    destination_port_id: dest.id,
    tenant_id: tenantId
  };

  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .insert(quotePayload)
    .select()
    .single();
  if (quoteError) {
    throw new Error(`Failed to create branded quote: ${quoteError.message}`);
  }

  const versionPayload = {
    quote_id: quote.id,
    version_number: 1,
    status: 'draft',
    tenant_id: tenantId
  };

  const { data: version, error: versionError } = await supabase
    .from('quotation_versions')
    .insert(versionPayload)
    .select()
    .single();
  if (versionError) {
    throw new Error(`Failed to create branded version: ${versionError.message}`);
  }

  const optionPayload = {
    quotation_version_id: version.id,
    total_amount: 1000,
    currency: 'USD',
    is_selected: true,
    tenant_id: tenantId
  };

  const { data: option, error: optionError } = await supabase
    .from('quotation_version_options')
    .insert(optionPayload)
    .select()
    .single();
  if (optionError) {
    throw new Error(`Failed to create branded option: ${optionError.message}`);
  }

  return { quote, version, origin, dest };
}

async function runBrandingTest() {
  console.log('--- Starting Tenant Branding E2E PDF Test ---');

  const tenantId = await ensureBrandingTenant();
  console.log(`Using Tenant ID: ${tenantId} with custom branding`);

  const { quote, version, origin, dest } = await createBrandedQuote(tenantId);
  console.log(`Created Branding Test Quote: ${quote.quote_number} (ID: ${quote.id})`);

  const generateUrl = `${supabaseUrl}/functions/v1/generate-quote-pdf`;
  const generatePayload = {
    quoteId: quote.id,
    versionId: version.id
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
    console.log('Branded PDF Generated via Edge Function.');
  } catch (err) {
    console.error('Generate Function Error:', err);
    process.exit(1);
  }

  const pdfBuffer = Buffer.from(pdfBase64, 'base64');
  console.log(`Branded PDF Size: ${pdfBuffer.length} bytes`);

  if (pdfBuffer.length < 100) {
    throw new Error('Branded PDF size is suspiciously small');
  }

  const header = pdfBuffer.slice(0, 5).toString();
  if (header !== '%PDF-') {
    throw new Error(`Invalid Branded PDF header: ${header}`);
  }

  const fileName = `e2e_branded_quote_edge.pdf`;
  fs.writeFileSync(fileName, pdfBuffer);
  console.log(`Saved ${fileName} to disk.`);

  console.log('--- Tenant Branding E2E PDF Test Completed ---');
}

runBrandingTest().catch(err => {
  console.error('Branding Test Failed:', err);
  process.exit(1);
});
