
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or ANON KEY) are required.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyDemandForecasting() {
  console.log('Verifying Demand Forecasting Infrastructure...');

  // 1. Check demand_predictions table
  const { data: predictions, error: predError } = await supabase
    .from('demand_predictions')
    .select('*')
    .limit(5);

  if (predError) {
    console.error('❌ Error fetching demand_predictions:', predError.message);
  } else {
    console.log(`✅ demand_predictions table exists. Found ${predictions.length} records.`);
  }

  // 2. Check master_commodities table
  const { data: commodities, error: commError } = await supabase
    .from('master_commodities')
    .select('*')
    .limit(1);

  if (commError) {
    console.error('❌ Error fetching master_commodities:', commError.message);
  } else {
    console.log(`✅ master_commodities table exists. Found ${commodities.length} records.`);
  }
  
  // 3. Verify RLS (Service Role should be able to insert)
  // We'll try to insert a dummy prediction if we have a commodity or just with HS code
  const dummyPrediction = {
    hs_code: 'TEST_HS_123',
    forecast_date: '2026-04-01',
    predicted_volume: 1000,
    confidence_score: 95.5,
    factors: { test: true },
    model_version: 'test-v1',
    // We need a tenant_id. Since we are using Service Role, RLS is bypassed or we need to provide it?
    // The policy "Tenant write demand predictions" uses auth.uid().
    // Service Role key usually bypasses RLS in Supabase client unless .auth.signIn is used or scoped client.
    // However, the table has NOT NULL tenant_id. We need to provide a valid UUID.
    tenant_id: '00000000-0000-0000-0000-000000000000' // Dummy UUID
  };
  
  // Note: If foreign key constraints exist on tenant_id (usually tenants table), this might fail.
  // Let's check if tenants table exists and get a valid id if possible.
  const { data: tenants } = await supabase.from('tenants').select('id').limit(1);
  if (tenants && tenants.length > 0) {
    dummyPrediction.tenant_id = tenants[0].id;
  }

  const { data: insertData, error: insertError } = await supabase
    .from('demand_predictions')
    .insert(dummyPrediction)
    .select();

  if (insertError) {
     // If it fails due to FK or other constraints, that's "good" in a way (schema works), 
     // but we want to confirm it's not a "table not found" error.
     console.log(`⚠️ Insert test result: ${insertError.message}`);
     if (insertError.message.includes('foreign key constraint')) {
        console.log('✅ Table exists and enforces constraints.');
     }
  } else {
    console.log('✅ Successfully inserted a test prediction record.');
    
    // Cleanup
    await supabase.from('demand_predictions').delete().eq('id', insertData[0].id);
    console.log('✅ Cleanup successful.');
  }
}

verifyDemandForecasting();
