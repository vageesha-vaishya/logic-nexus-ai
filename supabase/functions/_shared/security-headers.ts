// _shared/security-headers.ts
//
// Security response headers for Edge Function API endpoints.
//
// These complement the CORS headers in cors.ts.
// All headers are safe to add to JSON API responses — none interact
// with browser rendering (the SPA has its own CSP at the nginx layer).
//
// Usage (new functions):
//   import { apiHeaders } from "../_shared/cors.ts";
//   const h = apiHeaders(requestId);   // CORS + security + Content-Type
//   return new Response(body, { headers: h });
//
// Usage (one-off security headers only):
//   import { securityHeaders } from "../_shared/security-headers.ts";
//   const h = { ...corsHeaders, ...securityHeaders(requestId), "Content-Type": "application/json" };

// ── Static API security headers ──────────────────────────────────────────────

export const API_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  // Honour declared Content-Type; block MIME-sniffing attacks
  "X-Content-Type-Options": "nosniff",

  // APIs must never be framed — clickjacking irrelevant but defence-in-depth
  "X-Frame-Options": "DENY",

  // Don't leak full URL to third-party origins in the Referer header
  "Referrer-Policy": "strict-origin-when-cross-origin",

  // Prevent intermediary caches from storing sensitive API responses
  "Cache-Control": "no-store",

  // HSTS — Supabase Edge Functions are HTTPS-only; advertise this for 2 years
  // includeSubDomains is safe: *.supabase.co is always HTTPS
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",

  // Restrict browser feature access from API context (belt-and-braces)
  "Permissions-Policy": "geolocation=(), camera=(), microphone=(), payment=()",

  // Prevent cross-origin window handle leakage (Spectre mitigation)
  "Cross-Origin-Opener-Policy": "same-origin",
};

// ── Builder ───────────────────────────────────────────────────────────────────

/**
 * Returns API security headers, optionally echoing back a request ID for
 * distributed tracing.  The returned object is always a fresh copy.
 */
export function securityHeaders(requestId?: string | null): Record<string, string> {
  const h: Record<string, string> = { ...API_SECURITY_HEADERS };
  if (requestId) h["X-Request-Id"] = requestId;
  return h;
}
