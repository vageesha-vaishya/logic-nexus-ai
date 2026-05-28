// Phase 1 Slice D — One-click unsubscribe handler
// Per RFC 8058 + comms-infrastructure.md §4.6.
//
// Handles three forms of unsubscribe:
//
//   1. GET  /comms-unsubscribe?token=<...>
//        → render an HTML page asking the recipient to confirm. Some MUAs
//          render List-Unsubscribe as a clickable link; user clicks → lands
//          here → confirms.
//
//   2. POST /comms-unsubscribe?token=<...>
//        Body: List-Unsubscribe=One-Click
//        → RFC 8058 one-click flow. Gmail/Yahoo/Apple send this directly
//          when the user hits "Unsubscribe" inside the mail UI. Process
//          immediately without confirmation page. Return 200.
//
//   3. POST /comms-unsubscribe?token=<...>
//        Body: (empty or HTML form submit)
//        → User-confirmed unsubscribe from the GET landing page.
//
// Token format: see _shared/comms-unsubscribe-token.ts. HMAC-signed,
// stateless, contains {tenant_id, address, channel_kind, exp, nonce}.
//
// On successful unsubscribe: inserts comms.suppressions row with
// reason='unsubscribe', added_by_kind='recipient_unsubscribe'.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyUnsubscribeToken } from "../_shared/comms-unsubscribe-token.ts";

declare const Deno: any;

// ── HTML pages ───────────────────────────────────────────────────────────

function htmlConfirmPage(args: { address: string; channel_kind: string; token: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Unsubscribe — SOS Services</title>
<style>
  :root { --bg:#fff; --fg:#111; --muted:#666; --accent:#0066cc; --accent-dark:#004999; --danger:#b00020; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#0f0f10; --fg:#e8e8e8; --muted:#9a9a9a; --accent:#5aa5ff; --accent-dark:#3d8ce0; }
  }
  html,body { margin:0; padding:0; background:var(--bg); color:var(--fg); font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
  .wrap { max-width:520px; margin:48px auto; padding:0 24px; }
  h1 { font-size:22px; margin:0 0 12px; }
  p { margin:8px 0 16px; color:var(--muted); line-height:1.5; }
  .addr { background:rgba(0,0,0,.05); padding:2px 6px; border-radius:4px; font-family:ui-monospace,Menlo,monospace; font-size:14px; }
  button { background:var(--accent); color:#fff; border:0; border-radius:6px; padding:12px 20px; font-size:16px; cursor:pointer; }
  button:hover { background:var(--accent-dark); }
  .secondary { background:transparent; color:var(--muted); padding:8px 0; margin-left:12px; }
  .secondary:hover { background:transparent; color:var(--fg); }
  footer { margin-top:40px; font-size:12px; color:var(--muted); }
</style>
</head>
<body>
<div class="wrap">
  <h1>Unsubscribe?</h1>
  <p>You're about to unsubscribe <span class="addr">${escapeHtml(args.address)}</span> from ${escapeHtml(args.channel_kind)} communications.</p>
  <form method="POST" action="?token=${encodeURIComponent(args.token)}">
    <button type="submit">Yes, unsubscribe</button>
    <a class="secondary" href="https://sosservices.online">Cancel</a>
  </form>
  <footer>This link is unique to you. After unsubscribing, it may take a few minutes for the change to take effect.</footer>
</div>
</body>
</html>`;
}

function htmlSuccessPage(args: { address: string; channel_kind: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Unsubscribed — SOS Services</title>
<style>
  :root { --bg:#fff; --fg:#111; --muted:#666; --ok:#0a8a3c; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#0f0f10; --fg:#e8e8e8; --muted:#9a9a9a; --ok:#41c876; }
  }
  html,body { margin:0; padding:0; background:var(--bg); color:var(--fg); font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
  .wrap { max-width:520px; margin:48px auto; padding:0 24px; }
  h1 { font-size:22px; margin:0 0 12px; color:var(--ok); }
  p { margin:8px 0 16px; color:var(--muted); line-height:1.5; }
  .addr { background:rgba(0,0,0,.05); padding:2px 6px; border-radius:4px; font-family:ui-monospace,Menlo,monospace; font-size:14px; }
  footer { margin-top:40px; font-size:12px; color:var(--muted); }
  a { color:var(--muted); }
</style>
</head>
<body>
<div class="wrap">
  <h1>✓ Unsubscribed</h1>
  <p>We've removed <span class="addr">${escapeHtml(args.address)}</span> from our ${escapeHtml(args.channel_kind)} list.</p>
  <p>You won't receive further ${escapeHtml(args.channel_kind)} messages of this kind. Transactional messages (e.g. password resets, security alerts) may still be sent — those are required to operate your account.</p>
  <p>Changed your mind? Contact <a href="mailto:hello@sosservices.online">hello@sosservices.online</a>.</p>
  <footer>SOS Services</footer>
</div>
</body>
</html>`;
}

function htmlErrorPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Link expired — SOS Services</title>
<style>
  :root { --bg:#fff; --fg:#111; --muted:#666; --danger:#b00020; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#0f0f10; --fg:#e8e8e8; --muted:#9a9a9a; --danger:#ff6b8a; }
  }
  html,body { margin:0; padding:0; background:var(--bg); color:var(--fg); font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
  .wrap { max-width:520px; margin:48px auto; padding:0 24px; }
  h1 { font-size:22px; margin:0 0 12px; color:var(--danger); }
  p { margin:8px 0 16px; color:var(--muted); line-height:1.5; }
  a { color:var(--muted); }
</style>
</head>
<body>
<div class="wrap">
  <h1>Link expired or invalid</h1>
  <p>${escapeHtml(message)}</p>
  <p>If you wanted to unsubscribe, please reply to the email with the word <strong>unsubscribe</strong>, or contact <a href="mailto:hello@sosservices.online">hello@sosservices.online</a>.</p>
</div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── handlers ─────────────────────────────────────────────────────────────

async function applyUnsubscribe(args: {
  tenant_id: string;
  address: string;
  channel_kind: string;
  source_metadata: Record<string, unknown>;
}): Promise<void> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    db: { schema: "comms" },
    auth: { persistSession: false },
  });

  // Upsert ignoring duplicates — the recipient may click the link more than once.
  await admin
    .from("suppressions")
    .upsert(
      {
        tenant_id: args.tenant_id,
        channel_kind: args.channel_kind,
        address: args.address,
        reason: "unsubscribe",
        added_by_kind: "recipient_unsubscribe",
        source_metadata: args.source_metadata,
      },
      { onConflict: "tenant_id,channel_kind,address", ignoreDuplicates: true },
    );
}

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";

  if (!token) {
    return new Response(htmlErrorPage("This unsubscribe link is missing its token."), {
      status: 400,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const payload = await verifyUnsubscribeToken(token).catch(() => null);
  if (!payload) {
    return new Response(
      htmlErrorPage("This unsubscribe link is invalid or has expired."),
      { status: 400, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }

  // POST → process unsubscribe immediately. Includes RFC 8058 one-click
  // (`List-Unsubscribe=One-Click` body) and form-submit from the GET page.
  if (req.method === "POST") {
    const sourceMetadata: Record<string, unknown> = {
      user_agent: req.headers.get("user-agent") ?? null,
      ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      nonce: payload.nonce,
      issued_exp: payload.exp,
    };
    // Distinguish one-click from form-submit for audit observability.
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const body = await req.text();
      sourceMetadata.one_click = body.includes("List-Unsubscribe=One-Click");
      sourceMetadata.body_summary = body.slice(0, 200);
    }

    try {
      await applyUnsubscribe({
        tenant_id: payload.tenant_id,
        address: payload.address,
        channel_kind: payload.channel_kind,
        source_metadata: sourceMetadata,
      });
    } catch (err) {
      console.error("comms-unsubscribe: failed to insert suppression", err);
      return new Response(
        htmlErrorPage("We hit a problem applying your request. Please email hello@sosservices.online."),
        { status: 500, headers: { "content-type": "text/html; charset=utf-8" } },
      );
    }

    // For RFC 8058 one-click, just return 200 — the mail client doesn't render the body.
    if (sourceMetadata.one_click) {
      return new Response("OK", { status: 200 });
    }
    return new Response(
      htmlSuccessPage({ address: payload.address, channel_kind: payload.channel_kind }),
      { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }

  // GET → confirmation landing page.
  if (req.method === "GET") {
    return new Response(
      htmlConfirmPage({
        address: payload.address,
        channel_kind: payload.channel_kind,
        token,
      }),
      { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }

  return new Response("Method not allowed", { status: 405 });
}

serve(handleRequest);

export { handleRequest };
