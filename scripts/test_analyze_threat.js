import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "https://gzhxgoigflftharcmdqj.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || "";

const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function testAnalyzeThreat() {
  console.log("🧪 Testing analyze-email-threat...");

  // 1. Create/Login User to get valid token
  const TEST_EMAIL = `threat_tester_${Date.now()}@example.com`;
  const TEST_PASSWORD = 'password123';
  
  const { data: { user }, error: createError } = await adminSupabase.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true
  });
  
  if (createError) console.warn("User creation warning:", createError.message); // Might exist

  const { data: authData, error: authError } = await adminSupabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD
  });

  if (authError) {
      console.error("❌ Auth Failed:", authError.message);
      return;
  }
  const token = authData.session.access_token;
  console.log("✅ Authenticated as user.");

  // 2. Invoke Function with User Token
  const { data, error } = await adminSupabase.functions.invoke('analyze-email-threat', {
    body: {
      content: {
        body: "Urgent: Verify your account immediately by clicking this link: http://malicious.com",
        sender: "security@paypal-support.com",
        subject: "Account Alert"
      }
    },
    headers: {
        Authorization: `Bearer ${token}`
    }
  });

  if (error) {
    console.error("❌ Function failed:", error);
  } else {
    console.log("✅ Result:", JSON.stringify(data, null, 2));
  }
}

testAnalyzeThreat();
