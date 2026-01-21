const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Load env vars
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY; 

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env vars. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testAiAdvisor() {
  console.log('--- Testing AI Advisor Function ---');
  
  // Test 1: Suggest Unit
  console.log('\n1. Testing Unit Suggestion (Coal)...');
  const { data: unitData } = await supabase.functions.invoke('ai-advisor', {
    body: { action: 'suggest_unit', payload: { commodity: 'coal' } }
  });
  console.log('Result:', JSON.stringify(unitData));

  // Test 2: Generate Smart Quote (Full Flow)
  console.log('\n2. Testing Smart Quote Generation (Shanghai -> LA)...');
  const quotePayload = {
      origin: 'CNSHA',
      destination: 'USLAX',
      mode: 'ocean',
      commodity: 'Electronics',
      weight: 5002, // Changed again to force cache miss and test new deployment
      volume: 20,
      containerQty: 2,
      containerSize: '40ft'
  };

  const { data: quoteData, error: quoteError } = await supabase.functions.invoke('ai-advisor', {
      body: { action: 'generate_smart_quotes', payload: quotePayload }
  });

  if (quoteError) {
      console.error('Smart Quote Error:', quoteError);
  } else {
      console.log('Smart Quote Success!');
      if (quoteData.options) {
          console.log(`Generated ${quoteData.options.length} options.`);
          console.log('First Option Legs:', JSON.stringify(quoteData.options[0].legs, null, 2));
          console.log('First Option Price Breakdown:', JSON.stringify(quoteData.options[0].price_breakdown, null, 2));
      } else {
          console.log('No options returned. Raw:', quoteData);
      }
  }
}

testAiAdvisor();
