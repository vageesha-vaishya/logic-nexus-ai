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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { error } = await supabase.from("marketing_inquiries").insert({
    source_site: sourceSite,
    name,
    email,
    company: body.company ? String(body.company).trim().slice(0, 200) : null,
    role: body.role ? String(body.role).trim().slice(0, 100) : null,
    topic: body.topic ? String(body.topic).trim().slice(0, 100) : null,
    message,
    user_agent: (req.headers.get("user-agent") ?? "").slice(0, 500),
    ip_hash: ipHash,
  });

  if (error) {
    console.error("marketing-inquiry insert error:", error);
    return jsonResp(500, { error: "storage failed" }, origin);
  }

  return jsonResp(200, { ok: true }, origin);
});
