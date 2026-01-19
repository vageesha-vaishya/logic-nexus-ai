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
  console.log('Invoking sync-emails function...');
  
  const functionUrl = `${projectUrl}/functions/v1/sync-emails`;
  
  try {
    // Method 1: Direct fetch
    console.log(`\n--- Direct Fetch Test (${functionUrl}) ---`);
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountId: 'dummy-account-id'
      })
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    try {
        const text = await response.text();
        console.log('Response body:', text);
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
  
  // Fetch a valid account ID first
  console.log('Fetching a valid email account...');
  const { data: accounts, error: accError } = await supabase
    .from('email_accounts')
    .select('id, email_address')
    .limit(1);

  if (accError) {
    console.error('❌ Error fetching accounts:', accError);
    return;
  }

  if (!accounts || accounts.length === 0) {
    console.log('⚠️ No email accounts found in database. Testing with dummy ID.');
    await invokeSync('dummy-account-id');
  } else {
    const account = accounts[0];
    console.log(`✅ Found account: ${account.email_address} (${account.id})`);
    await invokeSync(account.id);
  }
}

async function invokeSync(accountId) {
  console.log(`Invoking sync-emails for accountId: ${accountId}`);
  const { data, error } = await supabase.functions.invoke('sync-emails', {
    body: {
        accountId: accountId
    }
  });

  if (error) {
    console.error('❌ Client invoke error:', error);
  } else {
    console.log('✅ Client invoke success (Data received):', data);
  }
}

testFunction();
