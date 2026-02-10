import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "https://gzhxgoigflftharcmdqj.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6aHhnb2lnZmxmdGhhcmNtZHFqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTUxOTY4NywiZXhwIjoyMDg1MDk1Njg3fQ.MImJoQhZUG2lSQ9PpN0z1QwDI1nvA2AsYPOeVfDGMos";

const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function runSimulation() {
  console.log("🚀 Starting E2E Email Simulation (v4)...");

  const TEST_EMAIL = `e2e_test_${Date.now()}@example.com`;
  const TEST_PASSWORD = 'password123';

  // 1. Create User
  console.log(`\n--- 1. Creating User: ${TEST_EMAIL} ---`);
  const { data: { user }, error: createError } = await adminSupabase.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true
  });

  if (createError) {
      console.error("❌ Failed to create user:", createError.message);
      return;
  }
  const userId = user.id;
  console.log(`✅ Created User: ${userId}`);

  // 2. Sign In (to get token)
  const { data: authData, error: authError } = await adminSupabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD
  });
  if (authError) {
      console.error("❌ Auth Failed:", authError.message);
      return;
  }
  const token = authData.session.access_token;
  console.log("✅ Authenticated.");

  // 3. Get/Create Tenant
  let tenantId = user.user_metadata?.tenant_id;
  if (!tenantId) {
      const { data: tenants } = await adminSupabase.from('tenants').select('id').limit(1);
      if (tenants?.length) tenantId = tenants[0].id;
  }

  // 4. Configure OAuth (Crucial Step!)
  console.log("\n--- 4. Configuring OAuth ---");
  const { error: oauthError } = await adminSupabase.from('oauth_configurations').upsert({
      user_id: userId,
      tenant_id: tenantId,
      provider: 'gmail',
      client_id: 'mock_client_id',
      client_secret: 'mock_client_secret',
      redirect_uri: 'http://localhost:3000/auth/callback',
      is_active: true,
      scopes: ["https://www.googleapis.com/auth/gmail.readonly"]
  }, { onConflict: 'user_id, provider' });
  
  if (oauthError) console.error("❌ OAuth Config Failed:", oauthError.message);
  else console.log("✅ OAuth Configured.");

  // 5. Create Email Account
  console.log("\n--- 5. Creating Email Account ---");
  const { data: acc, error: accError } = await adminSupabase.from('email_accounts').insert({
      user_id: userId,
      tenant_id: tenantId,
      email_address: 'tester@gmail.com',
      provider: 'gmail',
      display_name: 'E2E Tester',
      is_active: true,
      access_token: 'mock_access_token',
      refresh_token: 'mock_refresh_token',
      token_expires_at: new Date(Date.now() + 3600000).toISOString()
  }).select().single();
  
  if (accError) {
      console.error("❌ Account Creation Failed:", accError.message);
      return;
  }
  console.log(`✅ Email Account Created: ${acc.id}`);

  // 6. Test sync-emails-v2
  console.log("\n--- 6. Testing sync-emails-v2 ---");
  const { data: syncData, error: syncError } = await adminSupabase.functions.invoke('sync-emails-v2', {
      body: { accountId: acc.id, forceFullSync: false },
      headers: { Authorization: `Bearer ${token}` }
  });

  if (syncError) {
      console.error("❌ sync-emails-v2 Failed:", syncError.message);
      // If it's a 500 from the function, the SDK might wrap it.
      // We expect it to fail on actual Google API call, but NOT on 'missing config'.
  } else {
      console.log("✅ sync-emails-v2 Result:", syncData);
  }
  
  console.log("\n🏁 Simulation Complete.");
}

runSimulation();
