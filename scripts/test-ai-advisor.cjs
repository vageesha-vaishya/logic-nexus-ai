const { createClient } = require('@supabase/supabase-js');

// Load env vars
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY; // Anon key

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testAiAdvisor() {
  console.log('Testing ai-advisor function...');
  
  const payload = {
    action: 'suggest_unit',
    payload: {
      commodity: 'coal'
    }
  };

  const { data, error } = await supabase.functions.invoke('ai-advisor', {
    body: payload
  });

  if (error) {
    console.error('Function Error:', error);
  } else {
    console.log('Function Success:', JSON.stringify(data, null, 2));
  }
  
  // Test 2: Electronics
  const payload2 = {
    action: 'suggest_unit',
    payload: {
      commodity: 'iPhone 15 Pro'
    }
  };
  
  const { data: data2 } = await supabase.functions.invoke('ai-advisor', {
      body: payload2
  });
  console.log('Electronics Suggestion:', JSON.stringify(data2, null, 2));
}

testAiAdvisor();
