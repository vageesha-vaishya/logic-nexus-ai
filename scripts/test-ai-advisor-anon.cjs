const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Mimic Client Setup
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Missing env vars. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.');
  process.exit(1);
}

console.log(`Testing with URL: ${SUPABASE_URL}`);
console.log(`Using Anon Key: ${ANON_KEY.substring(0, 10)}...`);

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function testAnonAccess() {
  console.log('--- Testing AI Advisor with Anon Key ---');
  
  try {
      // Manual Fetch to control headers exactly like the client
      const functionUrl = `${SUPABASE_URL}/functions/v1/ai-advisor`;
      console.log(`POST ${functionUrl}`);
      
      const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${ANON_KEY}`,
              'apikey': ANON_KEY
          },
          body: JSON.stringify({ 
              action: 'suggest_unit', 
              payload: { commodity: 'test' } 
          })
      });

      console.log(`Status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
          const text = await response.text();
          console.error('Error Body:', text);
      } else {
          const data = await response.json();
          console.log('Success:', data);
      }

  } catch (err) {
      console.error('Fetch Error:', err);
  }
}

testAnonAccess();
