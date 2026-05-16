// _shared/cors.ts
//
// CORS headers and combined API response header builder.
//
// corsHeaders   — raw CORS headers (backward-compat, used by existing functions)
// apiHeaders()  — CORS + security headers + Content-Type (use for new functions)
// preflight()   — handle OPTIONS pre-flight and return a Response or null

import { securityHeaders } from "./security-headers.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, " +
    "x-tenant-id, x-franchise-id, x-signature, x-correlation-id, x-request-id",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

export function getCorsHeaders(_req?: Request) {
  return corsHeaders;
}

/**
 * Returns a complete set of response headers for JSON API endpoints:
 * CORS + security + Content-Type, with optional request-ID echo.
 *
 * This is the preferred header builder for all new Edge Functions.
 * Existing functions can migrate incrementally.
 *
 * @example
 *   const h = apiHeaders(requestId);
 *   return new Response(JSON.stringify(body), { status: 200, headers: h });
 */
export function apiHeaders(requestId?: string | null): Record<string, string> {
  return {
    ...corsHeaders,
    ...securityHeaders(requestId),
    "Content-Type": "application/json",
  };
}

export function preflight(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        ...corsHeaders,
        ...securityHeaders(),
      },
    });
  }
  return null;
}
