
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyPhase1() {
  console.log("\n--- Verifying Phase 1: Foundation & Zero-Trust Security ---");
  
  // 1.1 IAM (MFA)
  console.log("Checking 1.1 IAM (MFA)...");
  const { data: mfaCols, error: mfaError } = await supabase.rpc('get_table_columns', { p_table_name: 'email_account_delegations' });
  // Note: We'll use a raw SQL check helper since rpc might not exist for this specific check
  // Better approach: query information_schema via a known RPC or just trust the previous error if consistent.
  // But let's try a direct query if we had a SQL runner. We don't.
  // We will stick to the .from() check but handle the specific error more gracefully.
  
  const { error: mfaCheck } = await supabase
    .from('email_account_delegations')
    .select('requires_mfa')
    .limit(1);
  
  if (mfaCheck) console.error("  ❌ MFA Schema Check Failed:", mfaCheck.message);
  else console.log("  ✅ 'requires_mfa' column exists in 'email_account_delegations'");

  // 1.2 Domain Health
  console.log("Checking 1.2 Domain Health...");
  // Try to create a dummy record to force a check, or just select. 
  // If "schema cache" error persists, it means PostgREST doesn't know the table.
  const { error: domainError } = await supabase
    .from('compliance_domain_verifications')
    .select('id')
    .limit(1);

  if (domainError) {
      console.error("  ❌ Domain Health Schema Check Failed:", domainError.message);
      if (domainError.message.includes('schema cache')) {
          console.log("     (Hint: Try running 'NOTIFY pgrst, \"reload schema\"' in SQL editor or restarting Supabase)");
      }
  }
  else console.log("  ✅ 'compliance_domain_verifications' table exists");

  // 1.3 Data Encryption
  console.log("Checking 1.3 Data Encryption...");
  const { error: encryptError } = await supabase
    .from('emails')
    .select('body_encrypted')
    .limit(1);

  if (encryptError) console.error("  ❌ Encryption Schema Check Failed:", encryptError.message);
  else console.log("  ✅ 'body_encrypted' column exists in 'emails'");

  // Check RPC
  const { error: rpcError } = await supabase.rpc('get_decrypted_email_body', { p_email_id: '00000000-0000-0000-0000-000000000000' });
  // We expect an error because ID doesn't exist, but if RPC is missing, error will say "function not found"
  if (rpcError && rpcError.message.includes('function not found')) {
    console.error("  ❌ RPC 'get_decrypted_email_body' NOT found");
  } else {
    console.log("  ✅ RPC 'get_decrypted_email_body' is callable");
  }
}

async function verifyPhase2() {
  console.log("\n--- Verifying Phase 2: Integration & AI Intelligence ---");

  // 2.2 Threat Detection
  console.log("Checking 2.2 Threat Detection...");
  const { error: threatError } = await supabase
    .from('emails')
    .select('security_status, quarantine_reason')
    .limit(1);

  if (threatError) console.error("  ❌ Threat Detection Schema Check Failed:", threatError.message);
  else console.log("  ✅ 'security_status' and 'quarantine_reason' columns exist");

  // 2.3 Context-Aware Routing
  console.log("Checking 2.3 Context-Aware Routing...");
  const { error: aiError } = await supabase
    .from('emails')
    .select('ai_sentiment, ai_urgency')
    .limit(1);

  if (aiError) console.error("  ❌ Context-Aware Routing Schema Check Failed:", aiError.message);
  else console.log("  ✅ 'ai_sentiment' and 'ai_urgency' columns exist");
}

async function verifyPhase3() {
  console.log("\n--- Verifying Phase 3: Advanced Automation & Compliance ---");

  // 3.1 Automated Compliance
  console.log("Checking 3.1 Automated Compliance...");
  const { error: retentionError } = await supabase
    .from('compliance_retention_policies')
    .select('retention_days, action')
    .limit(1);

  if (retentionError) {
    console.error("  ❌ Compliance Schema Check Failed:", retentionError.message);
  } else {
    console.log("  ✅ 'compliance_retention_policies' table exists");
  }

  const { error: rpcPolicyError } = await supabase.rpc('execute_retention_policy', { p_policy_id: '00000000-0000-0000-0000-000000000000' });
  if (rpcPolicyError && rpcPolicyError.message.includes('function not found')) {
    console.error("  ❌ RPC 'execute_retention_policy' NOT found");
  } else {
    console.log("  ✅ RPC 'execute_retention_policy' is callable");
  }

  // 3.2 Sequences Engine
  console.log("Checking 3.2 Sequences Engine...");
  const { error: seqError } = await supabase
    .from('email_sequences')
    .select('id')
    .limit(1);
  const { error: stepError } = await supabase
    .from('email_sequence_steps')
    .select('id')
    .limit(1);
  const { error: enrollError } = await supabase
    .from('email_sequence_enrollments')
    .select('id')
    .limit(1);

  if (seqError || stepError || enrollError) console.error("  ❌ Sequence Schema Check Failed (One or more tables missing)");
  else console.log("  ✅ Sequence tables (sequences, steps, enrollments) exist");

  const { error: rpcSeqError } = await supabase.rpc('get_due_sequence_steps', { p_batch_size: 1 });
  if (rpcSeqError && rpcSeqError.message.includes('function not found')) {
    console.error("  ❌ RPC 'get_due_sequence_steps' NOT found");
  } else {
    console.log("  ✅ RPC 'get_due_sequence_steps' is callable");
  }

  // 3.3 Engagement Tracking
  console.log("Checking 3.3 Engagement Tracking...");
  const { error: trackError } = await supabase
    .from('email_tracking_events')
    .select('id, event_type, user_agent')
    .limit(1);

  if (trackError) console.error("  ❌ Tracking Schema Check Failed:", trackError.message);
  else console.log("  ✅ 'email_tracking_events' table exists");
}

async function main() {
  try {
    await verifyPhase1();
    await verifyPhase2();
    await verifyPhase3();
    console.log("\n--- Verification Complete ---");
  } catch (err) {
    console.error("Unexpected error:", err);
  }
}

main();
