
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyPhase3() {
  console.log('Starting Phase 3 (Vendor Performance Analytics) Verification...');

  try {
    // 0. Get Tenant ID
    const { data: tenantData } = await supabase.from('tenants').select('id').limit(1).single();
    const tenantId = tenantData?.id;
    console.log(`   Using Tenant ID: ${tenantId}`);

    // 1. Creating test vendor
    console.log('\n1. Creating test vendor...');
    const payload = {
        name: 'Test Vendor Phase 3',
        type: 'carrier', // ensuring this matches schema
        status: 'active',
        tenant_id: tenantId
    };
    console.log('   Payload:', payload);

    const { data: vendor, error: vendorError } = await supabase
      .from('vendors')
      .insert(payload)
      .select()
      .single();

    if (vendorError) throw new Error(`Failed to create vendor: ${vendorError.message}`);
    console.log(`   Vendor created: ${vendor.id}`);

    // 2. Create test shipments (some on time, some late)
    console.log('\n2. Creating test shipments...');
    const shipments = [
      {
        tenant_id: tenantId,
        vendor_id: vendor.id,
        shipment_number: 'SH-001',
        status: 'delivered',
        actual_delivery_date: new Date().toISOString(), 
        estimated_delivery_date: new Date().toISOString(),
        shipment_type: 'ocean_freight'
      },
      {
        tenant_id: tenantId,
        vendor_id: vendor.id,
        shipment_number: 'SH-002',
        status: 'delivered',
        actual_delivery_date: new Date(Date.now() - 86400000).toISOString(), // Delivered yesterday
        estimated_delivery_date: new Date().toISOString(), // Expected today (On time)
        shipment_type: 'air_freight'
      },
      {
        tenant_id: tenantId,
        vendor_id: vendor.id,
        shipment_number: 'SH-003',
        status: 'delivered',
        actual_delivery_date: new Date(Date.now() + 86400000).toISOString(), // Delivered tomorrow
        estimated_delivery_date: new Date().toISOString(), // Expected today (Late)
        shipment_type: 'inland_trucking'
      }
    ];
    
    const { error: shipmentError } = await supabase.from('shipments').insert(shipments);
    if (shipmentError) console.warn(`   Warning: Failed to create shipments: ${shipmentError.message}`);
    else console.log('   Shipments created.');

    // 3. Create quality claims
    console.log('\n3. Creating quality claims...');
    const { error: claimError } = await supabase.from('quality_claims').insert([
      {
        vendor_id: vendor.id,
        type: 'damage',
        claim_number: 'CLM-' + Date.now(),
        status: 'open',
        amount: 500.00,
        description: 'Test claim',
        claim_date: new Date().toISOString()
      }
    ]);
    if (claimError) console.warn(`   Warning: Failed to create claims: ${claimError.message}`);
    else console.log('   Quality claim created.');

    // 4. Run calculate_vendor_score RPC
    console.log('\n4. Running calculate_vendor_score RPC...');
    const { data: scoreData, error: rpcError } = await supabase.rpc('calculate_vendor_score', { p_vendor_id: vendor.id });
    
    if (rpcError) throw new Error(`RPC Failed: ${rpcError.message}`);
    
    console.log('   RPC Result:', JSON.stringify(scoreData, null, 2));

    // 5. Verify vendor record update
    console.log('\n5. Verifying vendor record update...');
    const { data: updatedVendor, error: fetchError } = await supabase
      .from('vendors')
      .select('current_performance_score, last_performance_update')
      .eq('id', vendor.id)
      .single();
      
    if (fetchError) throw new Error(`Failed to fetch updated vendor: ${fetchError.message}`);
    
    console.log(`   Current Score: ${updatedVendor.current_performance_score}`);
    console.log(`   Last Update: ${updatedVendor.last_performance_update}`);

    if (updatedVendor.current_performance_score !== null) {
        console.log('\nSUCCESS: Phase 3 Verification Passed!');
    } else {
        console.error('\nFAILURE: Score was not updated on vendor record.');
    }

    // Cleanup
    console.log('\nCleaning up...');
    await supabase.from('vendors').delete().eq('id', vendor.id);

  } catch (error) {
    console.error('\n❌ Verification Failed:', error);
    process.exit(1);
  }
}

verifyPhase3();
