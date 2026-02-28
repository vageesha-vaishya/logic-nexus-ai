
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testAuthEndpoint(functionName: string) {
  console.log(`Testing auth for function: ${functionName}`);

  // Test 1: No Authorization Header
  console.log('  Test 1: No Authorization Header...');
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: { some: 'payload' },
      headers: { } // Explicitly empty, though client might add anon key
    });
    
    // Note: invoke() automatically adds the anon key as Bearer if no other auth is provided? 
    // Actually, invoke() uses the client's auth session. If client is anon, it sends anon token.
    // To test "No Auth", we might need to use fetch directly.
  } catch (e) {
      console.log('  (Client error as expected or not?)', e);
  }

  // Use fetch for raw control
  const funcUrl = `${SUPABASE_URL}/functions/v1/${functionName}`;

  // 1. Missing Header
  const res1 = await fetch(funcUrl, {
    method: 'POST',
    body: JSON.stringify({}),
    headers: { 'Content-Type': 'application/json' }
  });
  console.log(`  -> Missing Auth Status: ${res1.status} (Expected 401 or 400 depending on implementation)`);
  if (res1.status === 401) console.log('     PASS');
  else console.log('     FAIL/WARN');

  // 2. Invalid Token
  const res2 = await fetch(funcUrl, {
    method: 'POST',
    body: JSON.stringify({}),
    headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid-token-123'
    }
  });
  console.log(`  -> Invalid Token Status: ${res2.status} (Expected 401)`);
  if (res2.status === 401) console.log('     PASS');
  else console.log('     FAIL');

  // 3. Valid Service Role (Should pass if function supports it, else 401 or 200)
  // ensemble-demand might not support service role directly for *user* logic but checks it?
  // Let's check a function we know uses requireAuth.
}

async function run() {
    await testAuthEndpoint('ensemble-demand');
    await testAuthEndpoint('ai-agent');
}

run();
