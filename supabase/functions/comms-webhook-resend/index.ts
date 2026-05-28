// Phase 1 Slice C — Resend webhook receiver
// Per comms-infrastructure.md §4.3 + master §7.4 Phase 1 Slice C extension.
//
// Closes G-CR-2 from comms-infrastructure.md §3: today's platform has no
// receiver for Resend's bounce / complaint / delivery webhooks, so sender
// reputation degrades silently. This function:
//
//   1. Verifies the Svix signature (Resend uses Svix for webhook delivery).
//   2. Dedupes via core.idempotency_keys (Svix may redeliver).
//   3. Inserts a comms.delivery_events row (UNIQUE on provider_event_id
//      catches duplicates if the idempotency check is bypassed somehow).
//   4. Updates the comms.deliveries aggregate via apply_delivery_event().
//   5. Auto-adds to comms.suppressions on hard bounces and complaints.
//   6. Returns 200 quickly — Svix retries 2xx, so we ack as soon as the row
//      is durable.
//
// Configuration:
//   - RESEND_WEBHOOK_SECRET: the Svix signing secret (starts `whsec_`).
//     Stored in env for Phase 1; moves to core.secrets in a follow-up.
//
// References:
//   https://resend.com/docs/dashboard/webhooks/introduction
//   https://docs.svix.com/receiving/verifying-payloads/how-manual

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

// ── types ────────────────────────────────────────────────────────────────

interface ResendBounceData {
  type?: "hard" | "soft";
  subType?: string;
  message?: string;
}

interface ResendEventData {
  email_id?: string;
  from?: string;
  to?: string[] | string;
  subject?: string;
  bounce?: ResendBounceData;
  click?: { ipAddress?: string; userAgent?: string; link?: string };
  open?: { ipAddress?: string; userAgent?: string };
  // Resend ships various extra fields per event type; we capture them in raw payload.
  [key: string]: unknown;
}

interface ResendWebhookEvent {
  type: string;                   // 'email.sent','email.delivered','email.bounced',...
  created_at: string;
  data: ResendEventData;
}

// ── signature verification ───────────────────────────────────────────────

const FIVE_MINUTES_MS = 5 * 60 * 1000;

async function verifySvixSignature(
  rawBody: string,
  headers: Headers,
  signingSecret: string,
): Promise<{ ok: true; svix_id: string } | { ok: false; reason: string }> {
  const svixId = headers.get("svix-id");
  const svixTimestamp = headers.get("svix-timestamp");
  const svixSignature = headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return { ok: false, reason: "missing svix-id/svix-timestamp/svix-signature header" };
  }

  // Replay protection — reject if timestamp is more than 5 minutes off.
  const tsMs = Number(svixTimestamp) * 1000;
  if (Number.isNaN(tsMs) || Math.abs(Date.now() - tsMs) > FIVE_MINUTES_MS) {
    return { ok: false, reason: "svix-timestamp out of tolerance window" };
  }

  // The signing secret begins with `whsec_`; the rest is base64.
  const secretBase64 = signingSecret.startsWith("whsec_")
    ? signingSecret.slice("whsec_".length)
    : signingSecret;
  let secretBytes: Uint8Array;
  try {
    secretBytes = base64Decode(secretBase64);
  } catch {
    return { ok: false, reason: "signing secret is not valid base64" };
  }

  // Signed content: `${svix_id}.${svix_timestamp}.${body}`
  const signedPayload = `${svixId}.${svixTimestamp}.${rawBody}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(signedPayload));
  const expectedSig = base64Encode(new Uint8Array(sig));

  // svix-signature header can carry multiple "v1,<sig>" entries (rotation), space-separated.
  const submittedSignatures = svixSignature
    .split(" ")
    .map((s) => s.trim())
    .filter((s) => s.startsWith("v1,"))
    .map((s) => s.slice(3));

  for (const submitted of submittedSignatures) {
    if (timingSafeEqual(submitted, expectedSig)) {
      return { ok: true, svix_id: svixId };
    }
  }
  return { ok: false, reason: "no submitted signature matches expected" };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function base64Decode(b64: string): Uint8Array {
  const binStr = atob(b64);
  const out = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) out[i] = binStr.charCodeAt(i);
  return out;
}

function base64Encode(bytes: Uint8Array): string {
  let binStr = "";
  for (let i = 0; i < bytes.length; i++) binStr += String.fromCharCode(bytes[i]);
  return btoa(binStr);
}

// ── event handling ───────────────────────────────────────────────────────

async function findOrCreateDelivery(
  admin: SupabaseClient,
  providerMessageId: string,
  fallbackTenantId: string | null,
  recipientAddress: string,
): Promise<string | null> {
  // Try to find existing delivery by provider_message_id
  const { data: existing } = await admin
    .from("deliveries")
    .select("id, tenant_id")
    .eq("provider", "resend")
    .eq("provider_message_id", providerMessageId)
    .maybeSingle();

  if (existing) return existing.id;

  // No existing row — webhook arrived for a delivery we don't know about.
  // This happens when the producer (send-email function) didn't insert a row
  // before sending. Create a placeholder so the event lands somewhere.
  // tenant_id is required NOT NULL; fall back to env-config if header missing.
  if (!fallbackTenantId) {
    return null; // can't create without tenant; event will be dropped with a warning
  }

  const { data: created, error } = await admin
    .from("deliveries")
    .insert({
      tenant_id: fallbackTenantId,
      channel_kind: "email",
      provider: "resend",
      provider_message_id: providerMessageId,
      recipient_address: recipientAddress.toLowerCase(),
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !created) return null;
  return created.id;
}

async function maybeAutoSuppress(
  admin: SupabaseClient,
  tenantId: string,
  recipientAddress: string,
  eventType: string,
  bounceKind: string | null,
  sourceEventId: string,
): Promise<void> {
  let reason: string | null = null;
  if (eventType === "email.complained") {
    reason = "complaint";
  } else if (eventType === "email.bounced" && bounceKind === "hard") {
    reason = "bounce_hard";
  }
  if (!reason) return;

  // Insert if not exists. ON CONFLICT (tenant_id, channel_kind, address) DO NOTHING
  // — but supabase-js doesn't expose ON CONFLICT cleanly; use upsert with ignoreDuplicates.
  await admin
    .from("suppressions")
    .upsert(
      {
        tenant_id: tenantId,
        channel_kind: "email",
        address: recipientAddress.toLowerCase().trim(),
        reason,
        source_event_id: sourceEventId,
        added_by_kind: "system",
      },
      { onConflict: "tenant_id,channel_kind,address", ignoreDuplicates: true },
    );
}

// ── main handler ─────────────────────────────────────────────────────────

async function handleResendWebhook(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  const signingSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (!signingSecret) {
    console.error("comms-webhook-resend: RESEND_WEBHOOK_SECRET not set");
    return new Response("server misconfigured", { status: 500 });
  }

  const rawBody = await req.text();

  // 1. Verify Svix signature
  const verifyResult = await verifySvixSignature(rawBody, req.headers, signingSecret);
  if (!verifyResult.ok) {
    console.warn(`comms-webhook-resend: signature rejected — ${verifyResult.reason}`);
    return new Response("invalid signature", { status: 401 });
  }
  const svixId = verifyResult.svix_id;

  // 2. Parse payload
  let event: ResendWebhookEvent;
  try {
    event = JSON.parse(rawBody) as ResendWebhookEvent;
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  if (!event.type || !event.data) {
    return new Response("missing type/data", { status: 400 });
  }

  // 3. DB clients (service_role to bypass RLS)
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    db: { schema: "comms" },
    auth: { persistSession: false },
  });
  const coreAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    db: { schema: "core" },
    auth: { persistSession: false },
  });

  // 4. Idempotency check via core.idempotency_keys
  // Key shape: 'comms-webhook-resend:<svix_id>' — Svix sends the same svix-id
  // on every retry of the same event.
  const idemKey = `comms-webhook-resend:${svixId}`;
  const { error: idemError } = await coreAdmin
    .from("idempotency_keys")
    .insert({ key: idemKey, recorded_at: new Date().toISOString() });
  if (idemError && idemError.code === "23505") {
    // Already processed — ack the retry and return.
    return new Response(JSON.stringify({ ok: true, deduped: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  if (idemError) {
    console.error("comms-webhook-resend: failed to insert idempotency key", idemError);
    // Continue cautiously — better duplicate effects than dropped events.
  }

  // 5. Resolve recipient address (Resend `data.to` may be string or array)
  const toRaw = event.data.to;
  const recipientAddress = Array.isArray(toRaw) ? toRaw[0] : (toRaw ?? "");
  const emailId = event.data.email_id ?? "";

  if (!emailId) {
    // Some webhook types may omit email_id; we can't link the event. Log and ack.
    console.warn(`comms-webhook-resend: event ${event.type} has no email_id; cannot link`);
    return new Response(JSON.stringify({ ok: true, linked: false }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  // 6. The fallback tenant_id for orphan webhook events comes from a custom
  // header set when registering the webhook URL with Resend. Resend supports
  // custom headers since 2024-06.
  const fallbackTenantId = req.headers.get("x-platform-tenant-id") ?? null;

  // 7. Find or create the delivery row
  const deliveryId = await findOrCreateDelivery(admin, emailId, fallbackTenantId, recipientAddress);
  if (!deliveryId) {
    console.warn(`comms-webhook-resend: no delivery row for email_id=${emailId} (no fallback tenant); event dropped`);
    return new Response(JSON.stringify({ ok: true, dropped: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  // Look up tenant_id from the delivery (so we attribute the event correctly
  // even if the original send used the fallback path).
  const { data: deliveryRow } = await admin
    .from("deliveries")
    .select("tenant_id")
    .eq("id", deliveryId)
    .single();
  const tenantId = deliveryRow?.tenant_id ?? fallbackTenantId;
  if (!tenantId) {
    return new Response("could not resolve tenant_id", { status: 500 });
  }

  // 8. Extract bounce kind / click URL / etc. for downstream columns
  const bounceKind = event.data.bounce?.type ?? null;
  const bounceReason = event.data.bounce?.subType ?? event.data.bounce?.message ?? null;
  const clickedUrl = event.data.click?.link ?? null;
  const ipAddress = event.data.click?.ipAddress ?? event.data.open?.ipAddress ?? null;
  const userAgent = event.data.click?.userAgent ?? event.data.open?.userAgent ?? null;

  // 9. Insert delivery_events row (UNIQUE on provider_event_id provides extra dedup)
  const { data: insertedEvent, error: insertError } = await admin
    .from("delivery_events")
    .insert({
      tenant_id: tenantId,
      delivery_id: deliveryId,
      event_type: event.type,
      occurred_at: event.created_at,
      provider_event_id: svixId,
      bounce_kind: bounceKind,
      bounce_reason: bounceReason,
      clicked_url: clickedUrl,
      ip_address: ipAddress,
      user_agent: userAgent,
      payload: event.data,
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      // UNIQUE(provider_event_id) conflict — already inserted by a retry that
      // bypassed the idempotency table (e.g. first attempt failed after insert).
      return new Response(JSON.stringify({ ok: true, event_already_recorded: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    console.error("comms-webhook-resend: failed to insert delivery_events row", insertError);
    return new Response("db error", { status: 500 });
  }

  // 10. Update the comms.deliveries aggregate
  const { error: applyError } = await admin.rpc("apply_delivery_event", {
    p_delivery_id: deliveryId,
    p_event_type: event.type,
    p_occurred_at: event.created_at,
    p_bounce_kind: bounceKind,
    p_error_text: bounceReason,
  });
  if (applyError) {
    console.error("comms-webhook-resend: apply_delivery_event RPC failed", applyError);
    // Continue — the event_log row is durable; aggregate is reconstructible.
  }

  // 11. Auto-suppress on hard bounce or complaint
  await maybeAutoSuppress(
    admin,
    tenantId,
    recipientAddress,
    event.type,
    bounceKind,
    insertedEvent!.id,
  );

  return new Response(JSON.stringify({ ok: true, delivery_id: deliveryId }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

// ── export ───────────────────────────────────────────────────────────────

serve(handleResendWebhook);

export { handleResendWebhook, verifySvixSignature };
