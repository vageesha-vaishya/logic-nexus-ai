import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://sosservices.online",
  "https://www.sosservices.online",
  "https://sosservices.in",
  "https://www.sosservices.in",
  "https://marketing.sosservices.online",
  "https://logicnexus.sosservices.online",
  "http://localhost:4321",
  "http://localhost:4322",
]);

// While we use Resend's test from-address (onboarding@resend.dev), Resend only allows
// sending to the signup email. Multi-recipient sends are rejected with 403. Once
// sosservices.online is verified as a Resend sending domain, add "hello@sosservices.online"
// back here and change NOTIFY_FROM to "noreply@sosservices.online".
const NOTIFY_RECIPIENTS = ["bahuguna.vimal@gmail.com"];
const NOTIFY_FROM = "SOS Services <onboarding@resend.dev>";

function corsHeaders(origin: string): Record<string, string> {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : "https://sosservices.online";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function jsonResp(status: number, body: unknown, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

async function sha256(s: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function notifyByEmail(payload: {
  sourceSite: string;
  name: string;
  email: string;
  company: string | null;
  role: string | null;
  topic: string | null;
  message: string;
  inquiryId: string;
}): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.warn("RESEND_API_KEY not set — skipping email notification");
    return;
  }

  const siteTag = payload.sourceSite.split(".")[0] || payload.sourceSite;
  const companyTag = payload.company ? ` at ${payload.company}` : "";
  const subject = `[${siteTag}] New inquiry from ${payload.name}${companyTag}`;

  const fields: [string, string | null][] = [
    ["Source site", payload.sourceSite],
    ["Name", payload.name],
    ["Email", payload.email],
    ["Company", payload.company],
    ["Role", payload.role],
    ["Topic", payload.topic],
  ];

  const rows = fields
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#64748b;font-size:13px;">${k}</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:500;">${escapeHtml(
          v as string,
        )}</td></tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html><body style="margin:0;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
    <div style="background:#0f172a;color:#fff;padding:16px 24px;font-size:13px;letter-spacing:0.05em;text-transform:uppercase;">
      Marketing inquiry · ${escapeHtml(payload.sourceSite)}
    </div>
    <div style="padding:24px;">
      <h1 style="margin:0 0 16px 0;font-size:20px;color:#0f172a;">New inquiry from ${escapeHtml(payload.name)}</h1>
      <table style="border-collapse:collapse;width:100%;margin-bottom:20px;">${rows}</table>
      <div style="border-top:1px solid #e2e8f0;padding-top:16px;">
        <div style="color:#64748b;font-size:13px;margin-bottom:8px;">Message</div>
        <div style="color:#0f172a;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(payload.message)}</div>
      </div>
      <div style="margin-top:24px;font-size:12px;color:#94a3b8;">
        Inquiry ID: <code>${payload.inquiryId}</code>
      </div>
    </div>
  </div>
</body></html>`;

  const text = [
    `New inquiry from ${payload.name}${payload.company ? " at " + payload.company : ""}`,
    "",
    ...fields.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`),
    "",
    "Message:",
    payload.message,
    "",
    `Inquiry ID: ${payload.inquiryId}`,
  ].join("\n");

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: NOTIFY_FROM,
        to: NOTIFY_RECIPIENTS,
        reply_to: payload.email,
        subject,
        html,
        text,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`Resend send failed (${res.status}):`, errBody);
    }
  } catch (err) {
    console.error("Resend send threw:", err);
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin") ?? "";

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return jsonResp(405, { error: "method not allowed" }, origin);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResp(400, { error: "invalid json" }, origin);
  }

  // Honeypot — silently accept bot submissions
  if (body.website) return jsonResp(200, { ok: true }, origin);

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const message = String(body.message ?? body.problem ?? "").trim();

  if (!name || !email || !message) {
    return jsonResp(400, { error: "name, email, and message are required" }, origin);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return jsonResp(400, { error: "invalid email" }, origin);
  }
  if (name.length > 200 || email.length > 200 || message.length > 5000) {
    return jsonResp(400, { error: "field too long" }, origin);
  }

  let sourceSite = "unknown";
  try {
    sourceSite = new URL(req.headers.get("referer") ?? origin).hostname;
  } catch {
    // leave as unknown
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "unknown")
    .split(",")[0]
    .trim() || "unknown";
  const ipHash = await sha256(ip);

  const company = body.company ? String(body.company).trim().slice(0, 200) : null;
  const role = body.role ? String(body.role).trim().slice(0, 100) : null;
  const topic = body.topic ? String(body.topic).trim().slice(0, 100) : null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { data: inserted, error } = await supabase
    .from("marketing_inquiries")
    .insert({
      source_site: sourceSite,
      name,
      email,
      company,
      role,
      topic,
      message,
      user_agent: (req.headers.get("user-agent") ?? "").slice(0, 500),
      ip_hash: ipHash,
    })
    .select("id")
    .single();

  if (error) {
    console.error("marketing-inquiry insert error:", error);
    return jsonResp(500, { error: "storage failed" }, origin);
  }

  // Fire-and-forget email notification — failure here does NOT fail the form
  notifyByEmail({
    sourceSite,
    name,
    email,
    company,
    role,
    topic,
    message,
    inquiryId: inserted?.id ?? "unknown",
  }).catch((err) => console.error("notifyByEmail unhandled:", err));

  return jsonResp(200, { ok: true }, origin);
});
