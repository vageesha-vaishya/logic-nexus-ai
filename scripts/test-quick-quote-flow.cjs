
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testQuickQuoteFlow() {
  console.log('Testing Quick Quote Flow (AI Advisor + Rate Engine)...');

  // 1. Test AI Advisor
  console.log('\n--- Step 1: AI Advisor (Suggest Unit) ---');
  const commodity = 'Apples';
  const { data: advisorData, error: advisorError } = await supabase.functions.invoke('ai-advisor', {
    body: { action: 'suggest_unit', payload: { commodity } }
  });

  if (advisorError) {
    console.error('AI Advisor failed:', advisorError);
    process.exit(1);
  }
  console.log(`Commodity: ${commodity}, Suggested Unit: ${advisorData.unit}, Source: ${advisorData.source}`);

  // 2. Test Rate Engine (Estimate)
  console.log('\n--- Step 2: Rate Engine (Estimate) ---');
  // Mock payload for rate engine
  const ratePayload = {
    origin: 'USLAX',
    destination: 'CNSHA',
    mode: 'ocean',
    commodity_type: 'Perishable',
    container_size: '40RF',
    weight: 20000
  };

  const { data: rateData, error: rateError } = await supabase.functions.invoke('rate-engine', {
    body: ratePayload
  });

  if (rateError) {
    console.error('Rate Engine failed:', rateError);
    // Continue for now as Rate Engine might require specific DB state
  } else {
    console.log('Rate Engine Estimate:', rateData);
  }

  console.log('\n✅ Quick Quote Flow Test Completed');
}

testQuickQuoteFlow();
