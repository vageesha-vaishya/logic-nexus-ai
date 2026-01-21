require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://iutyqzjlpenfddqdwcsk.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY; // Anon Key

if (!SUPABASE_KEY) {
    console.error("Missing VITE_SUPABASE_PUBLISHABLE_KEY.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testRateEngineAnon() {
  console.log('------------------------------------------------');
  console.log('Testing Scenario: Rate Engine (Anon Key)');
  
  const payload = {
    mode: 'ocean',
    origin: 'Shanghai, China (CNSHA)',
    destination: 'Los Angeles, USA (USLAX)',
    weight: 5000,
    containerQty: 1,
    containerSize: '20ft',
  };

  try {
      const { data, error } = await supabase.functions.invoke('rate-engine', {
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
        console.log('Sample Option:', data.options?.[0]?.name, data.options?.[0]?.price);
      }
  } catch (e) {
      console.error("Invocation failed:", e);
  }
}

testRateEngineAnon();