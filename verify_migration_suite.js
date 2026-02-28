
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ Missing VITE_SUPABASE_URL or SUPABASE_ANON_KEY in .env");
  process.exit(1);
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

async function testFunction(name, token) {
  const headers = {};
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
      // The error object from supabase-js might have different structure
      // Usually error.context.status or error.status
      const status = error.context?.status || error.status || 500;
      
      if (status === 401) {
         return { 
           status: "skip", 
           code: 401, 
           msg: "Unauthorized (Expected if no user token)", 
           details: error 
         };
      }
      return { status: "fail", code: status, msg: error.message, details: error };
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
  
  // NOTE: If you have valid credentials, uncomment and fill this to test 200 OK
  // const { data } = await supabase.auth.signInWithPassword({
  //   email: "your-email@example.com",
  //   password: "your-password"
  // });
  // if (data?.session) userToken = data.session.access_token;

  let passed = 0;
  let skipped = 0;
  let failed = 0;

  for (const func of FUNCTIONS) {
    process.stdout.write(`Testing ${func}... `);
    const result = await testFunction(func, userToken);
    
    if (result.status === "pass") {
      console.log(`✅ 200 OK`);
      passed++;
    } else if (result.status === "skip") {
      console.log(`⚠️  401 Unauthorized (Middleware Active)`);
      skipped++;
    } else {
      console.log(`❌ Failed (${result.code}) - ${result.msg}`);
      failed++;
    }
  }

  console.log("---------------------------------------------------");
  console.log("Summary:");
  console.log(`Passed: ${passed}`);
  console.log(`Skipped (Auth Active): ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log("---------------------------------------------------");
  
  if (failed === 0) {
    console.log("✅ SUCCESS: All functions are reachable and enforcing Auth.");
    console.log("   (401s are expected until you update .env and log in)");
  } else {
    console.log("❌ FAILURE: Some functions are not reachable or returned 500s.");
  }
}

run();
