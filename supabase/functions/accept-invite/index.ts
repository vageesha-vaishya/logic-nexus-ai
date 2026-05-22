// accept-invite — magic-link invitation handler.
//
// Called by /invite/[token] from the React app. Expects:
//   POST /functions/v1/accept-invite
//   Authorization: Bearer <user-jwt>
//   Body: { token: "<invitation-token>" }
//
// Flow:
//   1. Verify the caller is signed in (Supabase Auth attaches the JWT).
//   2. Call public.accept_invitation_by_token(token, user_id) — the
//      SECURITY DEFINER function validates token + expiry + email match,
//      inserts the user_roles row, points user_active_membership at it,
//      and marks the invitation accepted.
//   3. Translate SQL EXCEPTION keys into HTTP responses with a friendly
//      message + redirect hint for the React app to consume.
//
// The /invite/[token] page handles the signed-out branches by:
//   - If the invite email matches an existing auth.users (lookup via
//     a separate "invite-meta" endpoint not implemented here), prompting
//     sign-in and then POSTing here.
//   - Else, walking the user through a minimal signup form and calling
//     here after email verification.
//
// Both signed-in branches end up POSTing to this endpoint. The SQL fn
// raises invitation_email_mismatch if the JWT user's email doesn't match
// the invite — covers the "signed-in different email" path.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

// Maps the friendly EXCEPTION keys raised by accept_invitation_by_token
// to UI-ready error blobs. Anything else is a 500.
const ERROR_MAP: Record<string, { status: number; code: string; message: string }> = {
  invitation_not_found:                       { status: 404, code: "not_found",         message: "We couldn't find this invitation. The link may have been mistyped." },
  invitation_revoked:                         { status: 410, code: "revoked",            message: "This invitation was revoked by the admin who sent it." },
  invitation_expired:                         { status: 410, code: "expired",            message: "This invitation has expired. Ask your admin to send a new one." },
  invitation_email_mismatch:                  { status: 403, code: "email_mismatch",     message: "This invite is for a different email address. Sign in with the email it was sent to." },
  invitation_already_accepted_by_another_user:{ status: 409, code: "already_accepted",   message: "This invitation has already been used." },
  user_not_found:                             { status: 401, code: "auth_required",      message: "Sign in first, then click the invite link again." },
};

function jsonError(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ ok: false, code, message }), {
    status, headers: jsonHeaders,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonError(405, "method_not_allowed", "POST required");
  }

  let body: { token?: string };
  try { body = await req.json(); } catch {
    return jsonError(400, "bad_request", "Body must be valid JSON");
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return jsonError(400, "missing_token", "Invitation token is required");
  }

  // Use the caller's JWT to identify the user — we want auth.uid() to
  // resolve to the right user when the SECURITY DEFINER function reads
  // auth.users. The simplest way is to construct a client bound to the
  // user's JWT and let Supabase resolve the user.
  const supabaseUrl   = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey       = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error("accept-invite: missing env");
    return jsonError(500, "server_misconfig", "Server misconfiguration");
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonError(401, "auth_required", "Sign in first, then click the invite link again.");
  }
  const userJwt = authHeader.slice("Bearer ".length).trim();

  // Resolve the caller's user_id from their JWT via the auth-as-user client.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${userJwt}` } },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp?.user?.id) {
    return jsonError(401, "auth_required", "Sign in first, then click the invite link again.");
  }
  const userId = userResp.user.id;

  // Call the privileged accept function via the service-role client.
  const admin = createClient(supabaseUrl, serviceKey);
  const t0 = Date.now();
  const { data: result, error } = await admin.rpc("accept_invitation_by_token", {
    p_token:   token,
    p_user_id: userId,
  });

  if (error) {
    const key = (error.message ?? "").trim();
    const mapped = ERROR_MAP[key];
    if (mapped) {
      console.warn("accept-invite: friendly error", { user_id: userId, code: mapped.code, duration_ms: Date.now() - t0 });
      return jsonError(mapped.status, mapped.code, mapped.message);
    }
    console.error("accept-invite: unexpected RPC error", {
      user_id: userId, error: error.message, duration_ms: Date.now() - t0,
    });
    return jsonError(500, "accept_failed", "Could not accept the invite. Try again or ask your admin to resend it.");
  }

  console.log("accept-invite: ok", { user_id: userId, result, duration_ms: Date.now() - t0 });
  return new Response(JSON.stringify({
    ok:      true,
    user_id: userId,
    ...(typeof result === "object" && result !== null ? result : {}),
    redirect: "/dashboard",
  }), { status: 200, headers: jsonHeaders });
});
