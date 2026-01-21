
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY; // Using Anon key as client would

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testRateEngine() {
  console.log('Testing rate-engine function...');

  const payload = {
    origin: 'JFK',
    destination: 'LHR',
    weight: 100,
    mode: 'air',
    unit: 'kg',
    commodity: 'General Cargo'
  };

  console.log('Payload:', JSON.stringify(payload, null, 2));

  const { data, error } = await supabase.functions.invoke('rate-engine', {
    body: payload
  });

  if (error) {
    console.error('Function Error:', error);
    if (error instanceof Error) {
        console.error('Error Message:', error.message);
        console.error('Error Stack:', error.stack);
    }
  } else {
    console.log('Function Success:', JSON.stringify(data, null, 2));
  }
}

testRateEngine();
