
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runTest() {
  console.log('🚀 Starting Domain Service Lifecycle Test...');

  // 1. Get a Tenant ID (first available)
  const { data: tenants, error: tenantError } = await supabase
    .from('tenants')
    .select('id')
    .limit(1);

  if (tenantError) throw tenantError;
  if (!tenants || tenants.length === 0) throw new Error('No tenants found for testing');
  
  const tenantId = tenants[0].id;
  console.log(`✅ Using Tenant ID: ${tenantId}`);

  // 2. Get Service Type (Procurement Agent)
  const { data: type, error: typeError } = await supabase
    .from('service_types')
    .select('id, code, name')
    .eq('code', 'procurement_agent')
    .single();

  if (typeError) throw typeError;
  console.log(`✅ Using Service Type: ${type.code} (${type.id})`);

  // 3. Create a Service
  const serviceName = `Test Service ${Date.now()}`;
  console.log('Attempting to create service...');
  
  const { data: service, error: serviceError } = await supabase
    .from('services')
    .insert({
      service_name: serviceName,
      service_code: `TEST-${Date.now()}`,
      service_type: type.name, // Legacy string column
      service_type_id: type.id,
      tenant_id: tenantId,
      is_active: true,
      base_price: 1000,
      pricing_unit: 'per case'
    })
    .select()
    .single();

  if (serviceError) {
    console.error('Service creation error:', serviceError);
    throw serviceError;
  }
  console.log(`✅ Created Service: ${service.service_name} (${service.id})`);

  try {
    // 4. Create Service Details (Attributes)
    const attributes = {
      market_region: 'Asia',
      commission_rate_percent: 5.5,
      specialties: ['Electronics']
    };

    const { data: details, error: detailsError } = await supabase
      .from('service_details')
      .insert({
        service_id: service.id,
        tenant_id: tenantId,
        attributes: attributes
      })
      .select()
      .single();

    if (detailsError) throw detailsError;
    console.log(`✅ Created Service Details with attributes:`, details.attributes);

    // Verify values match
    if (details.attributes.market_region !== 'Asia' || details.attributes.commission_rate_percent !== 5.5) {
      throw new Error('Attribute mismatch!');
    }

    // 5. Update Service Details
    const updatedAttributes = {
      ...attributes,
      commission_rate_percent: 6.0,
      market_region: 'Global'
    };

    const { data: updatedDetails, error: updateError } = await supabase
      .from('service_details')
      .update({ attributes: updatedAttributes })
      .eq('service_id', service.id)
      .select()
      .single();

    if (updateError) throw updateError;
    console.log(`✅ Updated Service Details:`, updatedDetails.attributes);

    if (updatedDetails.attributes.commission_rate_percent !== 6.0) {
      throw new Error('Update failed!');
    }

    console.log('✅ Lifecycle Test Passed Successfully!');

  } catch (err) {
    console.error('❌ Test Failed:', err);
    throw err;
  } finally {
    // 6. Cleanup
    console.log('🧹 Cleaning up test data...');
    // service_details should cascade delete? Let's check.
    // Usually services delete cascades to details.
    const { error: deleteError } = await supabase
      .from('services')
      .delete()
      .eq('id', service.id);
    
    if (deleteError) console.error('Cleanup failed:', deleteError);
    else console.log('✅ Cleanup Complete');
  }
}

runTest().catch(err => {
  process.exit(1);
});
