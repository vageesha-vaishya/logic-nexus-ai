
import { createClient } from '@supabase/supabase-js';

// Load env vars
const projectUrl = "https://iutyqzjlpenfddqdwcsk.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1dHlxempscGVuZmRkcWR3Y3NrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NjQ4MjMsImV4cCI6MjA4NDI0MDgyM30.90USeHOMTy-Nz7AFZIwZ3s75AO5ch9uFgSHTDbmbWQw";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!projectUrl || !anonKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(projectUrl, serviceKey || anonKey);

async function testFunction() {
  console.log('Invoking sync-emails-v2 function...');
  
  const functionUrl = `${projectUrl}/functions/v1/sync-emails-v2`;

  // --- CONFIGURATION ---
  // 1. Get your Access Token from Browser DevTools -> Application -> Local Storage -> sb-*-auth-token
  // 2. Paste it below to test with REAL user permissions
  const USER_TOKEN = ""; 
  // ---------------------

  const authKey = serviceKey || anonKey;
  
  try {
    // Method 1: Direct fetch with INVALID TOKEN
    console.log(`\n--- Direct Fetch Test (Invalid Token) ---`);
    const responseInvalid = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer invalid-token-123`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accountId: 'dummy' })
    });
    console.log(`Status (Invalid): ${responseInvalid.status} ${responseInvalid.statusText}`);

    // Method 2: Direct fetch with VALID KEY
    console.log(`\n--- Direct Fetch Test (Valid Key) ---`);
    const responseValid = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accountId: 'dummy-account-id' })
    });
    console.log(`Status (Valid Service/Anon Key): ${responseValid.status} ${responseValid.statusText}`);

    if (USER_TOKEN) {
        console.log(`\n--- Direct Fetch Test (USER TOKEN) ---`);
        const responseUser = await fetch(functionUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${USER_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ accountId: 'dummy-account-id' })
        });
        console.log(`Status (User Token): ${responseUser.status} ${responseUser.statusText}`);
        if (responseUser.status === 401) {
            console.error("❌ Your USER TOKEN is Invalid or Expired!");
        } else if (responseUser.status === 404) {
            console.log("✅ Token accepted! (404 is expected for dummy account)");
        }
    } else {
        console.log(`\n--- Direct Fetch Test (USER TOKEN) ---`);
        console.log("⚠️  Skipping: No USER_TOKEN provided in script.");
    }


  } catch (err) {
    console.error('❌ Fetch error:', err.message);
  }

  // Method 3: Supabase Client Invoke
  console.log('\n--- Supabase Client Invoke Test ---');
  
  // Fetch a valid account ID first
  console.log('Fetching a valid email account...');
  
  let targetAccount = null;
  const targetEmail = 'vimal.bahuguna@miapps.co';
  
  // Try to find the specific test account first
  const { data: specificAccounts, error: specificError } = await supabase
    .from('email_accounts')
    .select('id, email_address')
    .eq('email_address', targetEmail)
    .limit(1);

  if (specificAccounts && specificAccounts.length > 0) {
      targetAccount = specificAccounts[0];
      console.log(`✅ Found target account: ${targetAccount.email_address} (${targetAccount.id})`);
  } else {
      console.log(`⚠️ Target account ${targetEmail} not found.`);
      
      // Check if any account exists
      const { data: accounts, error: accError } = await supabase
        .from('email_accounts')
        .select('id, email_address')
        .limit(1);
        
      if (accError) {
        console.error('❌ Error fetching accounts:', accError);
      } else if (accounts && accounts.length > 0) {
          targetAccount = accounts[0];
          console.log(`✅ Found fallback account: ${targetAccount.email_address} (${targetAccount.id})`);
      } else {
          console.log('⚠️ No email accounts found in database at all.');
      }
  }

  if (!targetAccount) {
    console.log('\n❌ CANNOT PROCEED WITH REAL TEST');
    console.log(`Please add the email account '${targetEmail}' to the 'email_accounts' table.`);
    console.log('You can do this via the application UI or SQL Editor.');
    console.log('Testing with dummy ID just to verify function reachability...');
    await invokeSync('dummy-account-id');
  } else {
    await invokeSync(targetAccount.id);
  }
}

async function invokeSync(accountId) {
  console.log(`Invoking sync-emails-v2 for accountId: ${accountId}`);
  const { data, error } = await supabase.functions.invoke('sync-emails-v2', {
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
