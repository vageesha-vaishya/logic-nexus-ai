
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// const TENANT_ID = '33816694-814b-4265-a65e-263624c87895'; // The tenant we are working with

async function verifyFrontendData() {
  // 0. Discover Tenants
  console.log('\n--- Discovering Tenants ---');
  const { data: tenants, error: tenantError } = await supabase
    .from('tenants')
    .select('id, name')
    .limit(5);
  
  if (tenantError) {
      console.error('Error fetching tenants:', tenantError);
  } else {
      console.log('Available Tenants:', tenants);
  }

  // 0.1 Discover Users to infer target tenant
  console.log('\n--- Discovering Users ---');
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, email, tenant_id')
    .limit(5);

  if (userError) {
      console.error('Error fetching users:', userError);
  } else {
      console.log('Available Users:', users);
  }

  const TENANT_ID = tenants?.[0]?.id || '33816694-814b-4265-a65e-263624c87895';
  console.log(`\nUsing Tenant ID for Verification: ${TENANT_ID}`);

  // 1. Check Service Type Mappings
  console.log('\n--- Checking Service Type Mappings ---');
  const { data: mappings, error: mappingError } = await supabase
    .from('service_type_mappings')
    .select('service_type_id, service_id, is_default, priority, is_active')
    .eq('tenant_id', TENANT_ID)
    .eq('is_active', true);

  if (mappingError) {
    console.error('Error fetching mappings:', mappingError);
  } else {
    console.log(`Found ${mappings?.length} active mappings.`);
    if (mappings && mappings.length > 0) {
      const serviceTypeIds = [...new Set(mappings.map(m => m.service_type_id))];
      console.log('Mapped Service Type IDs:', serviceTypeIds);

      // Check if these service types exist
      const { data: serviceTypes, error: stError } = await supabase
        .from('service_types')
        .select('id, name, code')
        .in('id', serviceTypeIds);
      
      if (stError) console.error('Error fetching service types:', stError);
      else console.log('Service Types details:', serviceTypes);
    } else {
      console.warn('WARNING: No service mappings found! The dropdowns will be empty.');
    }
  }

  // 2. Check Ports
  console.log('\n--- Checking Ports ---');
  const { data: ports, error: portsError } = await supabase
    .from('ports_locations')
    .select('id, location_name, location_code')
    .limit(5);

  if (portsError) {
    console.error('Error fetching ports:', portsError);
  } else {
    console.log(`Successfully fetched ports (showing first 5 of many):`);
    ports?.forEach(p => console.log(`- ${p.location_name} (${p.location_code}) [ID: ${p.id}]`));
    
    // Check total count
    const { count, error: countError } = await supabase
      .from('ports_locations')
      .select('*', { count: 'exact', head: true });
    
    if (!countError) console.log(`Total ports in DB: ${count}`);
  }

  // 3. Check Latest Quote Data
  console.log('\n--- Checking Latest Quote Data ---');
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('id, quote_number, service_type_id, service_id, origin_port_id, destination_port_id')
    .eq('tenant_id', TENANT_ID)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (quoteError) {
    console.error('Error fetching quote:', quoteError);
  } else if (quote) {
    console.log('Latest Quote:', quote);
    
    // Verify referenced IDs exist
    if (quote.service_type_id) {
        const { data: st } = await supabase.from('service_types').select('*').eq('id', quote.service_type_id).maybeSingle();
        console.log(`Quote Service Type (${quote.service_type_id}):`, st);
    } else {
        console.warn('Quote has NO service_type_id');
    }

    if (quote.service_id) {
        const { data: s } = await supabase.from('services').select('*').eq('id', quote.service_id).maybeSingle();
        console.log(`Quote Service (${quote.service_id}):`, s);
    } else {
        console.warn('Quote has NO service_id');
    }

    if (quote.origin_port_id) {
        const { data: op } = await supabase.from('ports_locations').select('id, location_name').eq('id', quote.origin_port_id).maybeSingle();
        console.log(`Quote Origin Port (${quote.origin_port_id}): ${op ? op.location_name : 'NOT FOUND'}`);
    } else {
        console.warn('Quote has NO origin_port_id');
    }
  } else {
    console.warn('No quotes found for this tenant.');
  }
}

verifyFrontendData().catch(console.error);
