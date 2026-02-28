
// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { load } from "https://deno.land/std@0.218.0/dotenv/mod.ts";

// Load environment variables
const env = await load();
const SUPABASE_URL = env["VITE_SUPABASE_URL"] || Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_ANON_KEY = env["SUPABASE_ANON_KEY"] || Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"] || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ Missing VITE_SUPABASE_URL or SUPABASE_ANON_KEY");
  Deno.exit(1);
}

console.log(`Target: ${SUPABASE_URL}`);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// List of functions to test
const FUNCTIONS = [
  "sync-emails-v2",
  "email-scan",
  "classify-email",
  "process-email-retention",
  "sync-cn-hs-data",
  "ingest-email",
  "search-emails",
  "track-email",
  "send-email",
  "sync-emails",
  "sync-all-mailboxes",
  "get-account-label",
  "create-user", 
  "delete-user",
  "lead-event-webhook",
  "subscription-plans",
  "plan-event-webhook",
  "remote-import",
  "export-data",
  "seed-platform-admin"
];

async function testFunction(name: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const start = performance.now();
  try {
    const { data, error } = await supabase.functions.invoke(name, {
      body: { test: true, email_id: "test_verification" },
      headers: headers
    });

    const duration = (performance.now() - start).toFixed(0);

    // Analyze result
    if (error) {
      // Check if it's the expected 401 from our new middleware
      if (error && (error.context?.status === 401 || error.status === 401)) {
         return { 
           status: "skip", 
           code: 401, 
           msg: "Unauthorized (Expected if no user token)", 
           details: error 
         };
      }
      return { status: "fail", code: error.status || 500, msg: error.message, details: error };
    }

    return { status: "pass", code: 200, msg: "OK", data };
  } catch (err) {
    return { status: "error", code: 0, msg: err.message };
  }
}

async function run() {
  console.log("---------------------------------------------------");
  console.log("🚀 Starting Edge Function Migration Verification");
  console.log("---------------------------------------------------");

  // Optional: Try to get a user token if email/pass provided
  let userToken = "";
  // Placeholder for login logic if we had credentials
  // const { data } = await supabase.auth.signInWithPassword(...)

  for (const func of FUNCTIONS) {
    console.log(`Testing ${func}...`);
    const result = await testFunction(func, userToken);
    
    if (result.status === "pass") {
      console.log(`✅ ${func}: 200 OK`);
    } else if (result.status === "skip") {
      console.log(`⚠️  ${func}: 401 Unauthorized (Auth middleware active)`);
      // console.log(`   Details: ${JSON.stringify(result.details)}`);
    } else {
      console.log(`❌ ${func}: Failed (${result.code}) - ${result.msg}`);
    }
  }

  console.log("---------------------------------------------------");
  console.log("Summary:");
  console.log("If all functions returned 401 (Unauthorized), the Auth Middleware is WORKING.");
  console.log("To verify 200 OK, you must update .env with new keys and log in.");
  console.log("---------------------------------------------------");
}

run();
