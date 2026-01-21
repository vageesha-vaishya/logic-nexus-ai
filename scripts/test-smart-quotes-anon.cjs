require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Use Anon Key to simulate client-side request
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://iutyqzjlpenfddqdwcsk.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY; // Anon Key

if (!SUPABASE_KEY) {
    console.error("Missing VITE_SUPABASE_PUBLISHABLE_KEY.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testSmartQuotesAnon() {
  console.log('------------------------------------------------');
  console.log('Testing Scenario: Ocean Freight (Anon Key)');
  
  const payload = {
    action: 'generate_smart_quotes',
    payload: {
      mode: 'ocean',
      origin: 'Shanghai, China (CNSHA)',
      destination: 'Los Angeles, USA (USLAX)',
      commodity: 'Consumer Electronics',
      weight: 5000,
      volume: 15,
      containerQty: 1,
      containerSize: '20ft',
      containerType: 'dry',
      dangerousGoods: false,
      specialHandling: 'Fragile',
      pickupDate: '2025-11-01',
      deliveryDeadline: '2025-11-30'
    }
  };

  try {
      const { data, error } = await supabase.functions.invoke('ai-advisor', {
        body: payload
      });

      if (error) {
        console.error('Function Error:', error);
        if (error.context) {
            try {
                const body = await error.context.json();
                console.error('Error Body:', body);
            } catch (e) {
                console.error('Could not parse error body');
            }
        }
      } else {
        console.log('✅ Success! Data received.');
        console.log('Options Count:', data.options?.length);
        if (data.options?.length > 0) {
            const firstOpt = data.options[0];
            console.log('Sample Option:', firstOpt.tier, firstOpt.transport_mode);
            console.log('Price:', firstOpt.price_breakdown?.total);
            console.log('Legs:', JSON.stringify(firstOpt.legs, null, 2));
            console.log('AI Explanation:', firstOpt.ai_explanation);
        }
        if (data.market_analysis) {
            console.log('Market Analysis Preview:', data.market_analysis.substring(0, 100) + '...');
        }
      }
  } catch (e) {
      console.error("Invocation failed:", e);
  }
}

testSmartQuotesAnon();