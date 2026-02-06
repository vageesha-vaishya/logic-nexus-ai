import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyDelayDetection() {
  console.log('🕒 Verifying Delay Detection Logic...');

  // 1. Get Tenant
  let tenantId;
  const { data: tenants } = await supabase.from('tenants').select('id').limit(1);
  if (tenants && tenants.length > 0) {
    tenantId = tenants[0].id;
  } else {
    console.error('❌ No tenants found.');
    process.exit(1);
  }

  // DEBUG: Check columns
  const { data: sample, error: sampleError } = await supabase.from('shipments').select('*').limit(1);
  if (sample && sample.length > 0) {
      console.log('Shipment Keys:', Object.keys(sample[0]));
  } else {
      console.log('No shipments found to inspect keys.');
  }

  // 2. Create Delayed Shipment
  // Estimated delivery was 3 days ago
  const delayedDate = new Date();
  delayedDate.setDate(delayedDate.getDate() - 3);

  const shipmentNum = `DELAY-TEST-${Date.now()}`;
  const { data: shipment, error: shipError } = await supabase
    .from('shipments')
    .insert({
      tenant_id: tenantId,
      shipment_number: shipmentNum,
      shipment_type: 'ocean_freight',
      status: 'in_transit',
      estimated_delivery_date: delayedDate.toISOString().split('T')[0], // YYYY-MM-DD
      total_weight_kg: 100
    })
    .select()
    .single();

  if (shipError) {
    console.error('❌ Failed to create delayed shipment:', shipError.message);
    process.exit(1);
  }
  console.log(`✅ Created Delayed Shipment: ${shipment.shipment_number} (ETA: ${shipment.estimated_delivery_date})`);

  // 3. Run Detection RPC
  console.log('🔄 Running check_shipment_delays RPC...');
  const { data: rpcResult, error: rpcError } = await supabase
    .rpc('check_shipment_delays', { p_tenant_id: tenantId });

  if (rpcError) {
    console.error('❌ RPC Failed:', rpcError.message);
    // Cleanup
    await supabase.from('shipments').delete().eq('id', shipment.id);
    process.exit(1);
  }

  console.log('✅ RPC Result:', rpcResult);

  // 4. Verify Delay Record
  const { data: delay, error: delayError } = await supabase
    .from('shipment_delays')
    .select('*')
    .eq('shipment_id', shipment.id)
    .single();

  if (delayError) {
    console.error('❌ Failed to find delay record:', delayError.message);
  } else {
    console.log(`✅ Delay Detected!`);
    console.log(`   Reason: ${delay.delay_reason}`);
    console.log(`   Severity: ${delay.severity}`);

    if (delay.severity === 'medium' || delay.severity === 'high') {
         console.log('✅ CORRECT: Severity matches days overdue (3 days).');
    } else {
         console.warn(`⚠️ Unexpected severity: ${delay.severity}`);
    }
  }

  // Cleanup
  console.log('🧹 Cleaning up...');
  await supabase.from('shipment_delays').delete().eq('shipment_id', shipment.id);
  await supabase.from('shipments').delete().eq('id', shipment.id);

  console.log('✨ Verification Complete!');
}

verifyDelayDetection().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
