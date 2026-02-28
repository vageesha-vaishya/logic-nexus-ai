import { serveWithLogger } from "../_shared/logger.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const GIF_1x1 = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
  0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b
]);

serveWithLogger(async (req, logger, supabaseAdmin) => {
  const url = new URL(req.url);
  const path = url.pathname.split("/").pop(); // 'open' or 'click'
  
  // Basic CORS for all requests
  const headers = {
    ...getCorsHeaders(req),
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  // Parse parameters
  const emailId = url.searchParams.get("id");
  const redirectUrl = url.searchParams.get("url"); // Only for clicks

  if (!emailId) {
    return new Response("Missing email ID", { status: 400, headers });
  }

  // Initialize Supabase (Service Role required for anonymous tracking)
  const supabase = supabaseAdmin;

  // Extract Metadata
  const userAgent = req.headers.get("user-agent") || "unknown";
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  // Basic GeoIP lookup could happen here if we had a provider, 
  // or we rely on the client IP being stored and processed later.
  
  // Determine Event Type
  const eventType = path === "click" ? "click" : "open";

  // Async Logging (Fire and Forget to not delay response)
  const logEvent = async () => {
    try {
      await supabase.from("email_tracking_events").insert({
        email_id: emailId,
        event_type: eventType,
        url: redirectUrl, // null for opens
        ip_address: ip,
        user_agent: userAgent,
        // location: {} // Implement GeoIP later
      });
    } catch (err) {
      logger.error(`Failed to log ${eventType} for ${emailId}:`, { error: err });
    }
  };

  // Trigger logging but don't await it for the response (performance)
  // Note: Deno deploy might kill the background task if response returns too fast,
  // but usually a short insert is fine. For guaranteed delivery, await it.
  await logEvent();

  // Handle Response
  if (eventType === "click") {
    if (!redirectUrl) {
      return new Response("Missing redirect URL", { status: 400, headers });
    }
    // Validate URL to prevent open redirects (basic check)
    try {
        new URL(redirectUrl); // simple validation
    } catch {
        return new Response("Invalid URL", { status: 400, headers });
    }

    return Response.redirect(redirectUrl, 302);
  } else {
    // Return 1x1 GIF
    return new Response(GIF_1x1, {
      status: 200,
      headers: {
        ...headers,
        "Content-Type": "image/gif",
        "Content-Length": GIF_1x1.length.toString(),
      },
    });
  }
}, "track-email");
