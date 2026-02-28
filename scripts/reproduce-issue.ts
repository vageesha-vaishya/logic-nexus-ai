// Script to verify update permission and reproduce 406
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function reproduceUpdateIssue() {
  console.log('--- Attempting to reproduce 406 on update ---');
  
  // 1. Get a valid tenant ID first
  const { data: configs } = await supabase.from('quotation_configuration').select('tenant_id').limit(1);
  if (!configs || configs.length === 0) {
    console.log('No configuration found to test with.');
    return;
  }
  const tenantId = configs[0].tenant_id;
  console.log('Using tenant ID:', tenantId);

  // 2. Try update with .select().maybeSingle() using SERVICE ROLE (should work)
  console.log('\nTest 1: Update via Service Role (should succeed)');
  const { data: res1, error: err1 } = await supabase
    .from('quotation_configuration')
    .update({ smart_mode_enabled: true })
    .eq('tenant_id', tenantId)
    .select()
    .maybeSingle();

  if (err1) {
    console.error('Test 1 Failed:', err1);
  } else {
    console.log('Test 1 Success:', res1 ? 'Data returned' : 'No data returned (null)');
  }

  // 3. To truly reproduce 406, we need to simulate a user who might have limited access
  // But we can't easily simulate a specific user without their token here.
  // However, we can check if RLS policies are weird.
  
  // Let's check the policies again via SQL inspection if possible or just rely on previous knowledge.
  // The policy for "Admins can manage quotation config" uses:
  // tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(...) OR ...)

  // If the user doesn't match the tenant_id check, the update finds 0 rows.
  // If 0 rows are updated, .select() returns 0 rows.
  // .maybeSingle() on 0 rows returns null (no error).
  
  // So why 406?
  // 406 happens if the response format requested is not supported.
  // If .single() was used, 0 rows -> 406 (sometimes mapped from 406 to JSON error).
  // Actually, PostgREST returns 406 Not Acceptable when `result-set-cardinality` header requirement isn't met.
  // .single() requires cardinality=1.
  // .maybeSingle() requires cardinality<=1.
  
  // If the user is getting 406, maybe they are still running the OLD code in their browser?
  // The user says "network-logger.ts:70 PATCH ... 406".
  // This strongly implies the browser is sending a request that expects a single result.
  
  // If I updated the code to use .maybeSingle(), the headers sent by the client should change to allow 0 or 1.
  // Header: `Accept: application/vnd.pgrst.object+json` is sent for BOTH single and maybeSingle.
  // However, `Prefer: return=representation` is sent for .select().
  
  // Wait, if I use `maybeSingle()`, the client handles the error if it comes back as 406?
  // No, `maybeSingle()` is a client-side helper in supabase-js v2. 
  // In v1 it might be different, but here we are likely on v2.
  
  // Actually, `maybeSingle()` does NOT set a different Accept header than `single()`. 
  // Both set `Accept: application/vnd.pgrst.object+json`.
  // PostgREST returns 406 if the result set is empty when that Accept header is present AND the server is configured/versioned such that it enforces it strictly?
  // Actually, PostgREST usually returns `200 OK` with `null` body if `vnd.pgrst.object+json` is requested but result is empty? 
  // NO. Standard PostgREST behavior:
  // If `Accept: application/vnd.pgrst.object+json` is sent:
  // - 1 row: 200 OK, body = object
  // - 0 rows: 406 Not Acceptable (error string: "The result contains 0 rows")
  // - >1 rows: 406 Not Acceptable (error string: "The result contains X rows")
  
  // Supabase JS `maybeSingle()` works around this by NOT sending the `object+json` header?
  // Let's check Supabase JS source or docs behavior.
  // Actually, `maybeSingle()` usually requests array `application/json` and then checks length locally.
  // `single()` requests `application/vnd.pgrst.object+json` to let server enforce it? 
  // Or does `single()` also request array and check locally?
  
  // If the client is sending `Accept: application/vnd.pgrst.object+json`, then 0 rows WILL trigger 406.
  // The browser log says 406.
  
  // HYPOTHESIS: The `.maybeSingle()` change I made hasn't propagated to the running client code, OR `maybeSingle()` in this version of supabase-js still sends the strict header.
  // BUT `maybeSingle()` is specifically designed to handle 0 rows.
  
  // Let's verify what `maybeSingle()` does in this codebase.
  // I can't check node_modules easily, but standard behavior is:
  // .maybeSingle() -> select() without arguments implies *, but usually it uses `limit(1)` and handles array.
  
  // Wait, I did:
  // .update(...).eq(...).select().maybeSingle()
  
  // If I change it to:
  // .update(...).eq(...).select()
  // And then manually check length.
  // This avoids the 406 from server entirely because we accept array `application/json`.
  
  console.log('\nRecommendation: Change .maybeSingle() to .select() and handle array manually to be safe against 406.');
}

reproduceUpdateIssue();
