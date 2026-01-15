
import { createClient } from '@supabase/supabase-js';

const projectUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!projectUrl || !anonKey) {
  console.error('Error: VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY not found in environment');
  process.exit(1);
}

console.log(`Testing connection to Supabase project: ${projectUrl}`);

const supabase = createClient(projectUrl, anonKey);

async function testFunction() {
  console.log('Invoking execute-sql-external function...');
  
  const functionUrl = `${projectUrl}/functions/v1/execute-sql-external`;
  
  try {
    // Method 1: Direct fetch (to check headers/CORS/raw response)
    console.log(`\n--- Direct Fetch Test (${functionUrl}) ---`);
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'test',
        connection: {
          host: 'test-host',
          database: 'test-db',
          user: 'test-user',
          password: 'test-password'
        }
      })
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    try {
        const text = await response.text();
        console.log('Response body:', text.substring(0, 500) + (text.length > 500 ? '...' : ''));
    } catch (e) {
        console.log('Could not read response body');
    }

    if (response.ok) {
        console.log('✅ Direct fetch successful (Function is reachable)');
    } else {
        console.log('❌ Direct fetch failed');
    }

  } catch (err) {
    console.error('❌ Direct fetch error:', err.message);
  }

  // Method 2: Supabase Client Invoke
  console.log('\n--- Supabase Client Invoke Test ---');
  const { data, error } = await supabase.functions.invoke('execute-sql-external', {
    body: {
        action: 'test',
        connection: {
          host: 'test-host',
          database: 'test-db',
          user: 'test-user',
          password: 'test-password'
        }
    }
  });

  if (error) {
    console.error('❌ Client invoke error:', error);
  } else {
    console.log('✅ Client invoke success (Data received):', data);
  }
}

testFunction();
