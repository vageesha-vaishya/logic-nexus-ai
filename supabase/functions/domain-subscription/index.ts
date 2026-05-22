// domain-subscription — per-(tenant, domain) plan activation via Razorpay
// (Phase D · task U-D2).
//
// POST /functions/v1/domain-subscription   body: { action, ... }
//
// Actions:
//   create_payment(assignment_id, plan_id)
//     → returns { order_id, amount, currency, key_id } so the client can
//       open Razorpay Checkout. Verifies the caller is a tenant_admin /
//       platform_admin of the target tenant.
//
//   confirm_payment(assignment_id, razorpay_order_id, razorpay_payment_id,
//                   razorpay_signature)
//     → verifies the HMAC-SHA256 signature, flips
//       tenant_domain_assignments → status='active', plan_id, trial_ends_at=NULL,
//       razorpay_subscription_id=razorpay_payment_id.
//       (The first payment id stands in for the Razorpay subscription id
//       until the proper subscriptions-API flow lands.)
//
// verify_jwt is true — the caller's JWT identifies which user is doing
// the activation. The function then double-checks via user_roles RLS.
//
// If RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not configured, the
// function returns 503 with a friendly message — the BillingSettings
// page falls back to a "Razorpay not configured yet" affordance.
//
// See docs/plans/2026-05-22-unified-platform-onboarding-design.md.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const RAZORPAY_KEY_ID     = Deno.env.get("RAZORPAY_KEY_ID")     ?? "";
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";

function jsonError(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ ok: false, code, message }), {
    status, headers: jsonHeaders,
  });
}

function razorpayAuth(): string {
  return "Basic " + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
}

async function verifySignature(orderId: string, paymentId: string, signature: string): Promise<boolean> {
  const expected = orderId + "|" + paymentId;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(RAZORPAY_KEY_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const macBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(expected));
  const hex = Array.from(new Uint8Array(macBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === signature;
}

interface AdminContext {
  userId:   string;
  tenantId: string;
}

async function requireTenantAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userClient: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin:      any,
  assignmentId: string,
): Promise<AdminContext> {
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp?.user?.id) throw new Error("auth_required");
  const userId = userResp.user.id;

  // Service-role read of the assignment + role check (RLS doesn't reach
  // into both tables for an authorization-style check, so we do it here).
  const { data: assignment, error: aErr } = await admin
    .from("tenant_domain_assignments")
    .select("id, tenant_id")
    .eq("id", assignmentId)
    .maybeSingle();
  if (aErr || !assignment) throw new Error("assignment_not_found");

  const { data: roles, error: rErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id",  userId)
    .eq("tenant_id", assignment.tenant_id);
  if (rErr) throw new Error("role_check_failed");

  const allowedRoles = new Set(["tenant_admin", "platform_admin"]);
  const ok = (roles ?? []).some((r: { role: string }) => allowedRoles.has(r.role));
  if (!ok) throw new Error("not_authorized");

  return { userId, tenantId: assignment.tenant_id };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")    return jsonError(405, "method_not_allowed", "POST required");

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return jsonError(503, "razorpay_not_configured",
      "Razorpay isn't connected yet. Set RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET in the project secrets and redeploy this function.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try { body = await req.json(); } catch {
    return jsonError(400, "bad_request", "Body must be valid JSON");
  }
  const action = body?.action as string | undefined;

  const supabaseUrl   = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey       = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return jsonError(500, "server_misconfig", "Server misconfiguration");
  }
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonError(401, "auth_required", "Sign in first.");
  }
  const userJwt = authHeader.slice("Bearer ".length).trim();
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${userJwt}` } },
  });
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    if (action === "create_payment") {
      const assignmentId = String(body.assignment_id ?? "");
      const planId       = String(body.plan_id ?? "");
      if (!assignmentId || !planId) return jsonError(400, "bad_request", "assignment_id + plan_id required");

      await requireTenantAdmin(userClient, admin, assignmentId);

      // Look up plan price
      const { data: plan, error: pErr } = await admin
        .from("subscription_plans")
        .select("id, name, price_monthly, currency")
        .eq("id", planId)
        .maybeSingle();
      if (pErr || !plan) return jsonError(404, "plan_not_found", "Plan not found.");
      if (Number(plan.price_monthly) <= 0) return jsonError(400, "free_plan", "Free plans don't need a card.");

      // Razorpay order amount is in the smallest currency unit (paise / cents).
      const amountMinor = Math.round(Number(plan.price_monthly) * 100);
      const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: { Authorization: razorpayAuth(), "Content-Type": "application/json" },
        body: JSON.stringify({
          amount:   amountMinor,
          currency: plan.currency,
          notes: {
            assignment_id: assignmentId,
            plan_id:       planId,
            plan_name:     plan.name,
          },
        }),
      });
      const orderJson = await orderRes.json();
      if (!orderRes.ok) {
        return jsonError(502, "razorpay_order_failed",
          orderJson?.error?.description ?? `Razorpay error ${orderRes.status}`);
      }

      return new Response(JSON.stringify({
        ok:        true,
        order_id:  orderJson.id,
        amount:    orderJson.amount,
        currency:  orderJson.currency,
        key_id:    RAZORPAY_KEY_ID,
        plan_name: plan.name,
      }), { status: 200, headers: jsonHeaders });
    }

    if (action === "confirm_payment") {
      const assignmentId = String(body.assignment_id ?? "");
      const orderId      = String(body.razorpay_order_id   ?? "");
      const paymentId    = String(body.razorpay_payment_id ?? "");
      const signature    = String(body.razorpay_signature  ?? "");
      const planId       = String(body.plan_id ?? "");
      if (!assignmentId || !orderId || !paymentId || !signature || !planId) {
        return jsonError(400, "bad_request", "Missing one of: assignment_id, plan_id, razorpay_{order,payment,signature}_id");
      }

      await requireTenantAdmin(userClient, admin, assignmentId);

      const ok = await verifySignature(orderId, paymentId, signature);
      if (!ok) return jsonError(400, "signature_mismatch", "Payment signature did not verify. Refresh and try again.");

      const { error: uErr } = await admin
        .from("tenant_domain_assignments")
        .update({
          subscription_status:      "active",
          plan_id:                  planId,
          trial_ends_at:            null,
          razorpay_subscription_id: paymentId,
          updated_at:               new Date().toISOString(),
        })
        .eq("id", assignmentId);
      if (uErr) return jsonError(500, "update_failed", uErr.message);

      console.log("domain-subscription: confirmed", { assignment_id: assignmentId, payment_id: paymentId });
      return new Response(JSON.stringify({ ok: true, assignment_id: assignmentId }), {
        status: 200, headers: jsonHeaders,
      });
    }

    return jsonError(400, "unknown_action", `Unknown action: ${action}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const map: Record<string, { status: number; code: string; message: string }> = {
      auth_required:         { status: 401, code: "auth_required",     message: "Sign in first." },
      assignment_not_found:  { status: 404, code: "not_found",          message: "Plan assignment not found." },
      not_authorized:        { status: 403, code: "not_authorized",     message: "Only tenant admins can change billing." },
      role_check_failed:     { status: 500, code: "role_check_failed",  message: "Couldn't verify your access." },
    };
    const mapped = map[msg];
    if (mapped) return jsonError(mapped.status, mapped.code, mapped.message);
    console.error("domain-subscription: unexpected", { msg });
    return jsonError(500, "internal", "Unexpected server error.");
  }
});
