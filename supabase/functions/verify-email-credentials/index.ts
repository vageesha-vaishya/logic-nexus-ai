import { serve } from "std/http/server.ts";
import { ImapFlow } from "npm:imapflow";
import { getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }

  try {
    const { imap, smtp } = await req.json();

    if (!imap || !imap.host || !imap.username || !imap.password) {
      throw new Error("Missing IMAP credentials");
    }

    console.log(`Verifying IMAP connection for ${imap.username} at ${imap.host}:${imap.port}`);

    const client = new ImapFlow({
      host: imap.host,
      port: imap.port || 993,
      secure: imap.secure ?? true,
      auth: {
        user: imap.username,
        pass: imap.password,
      },
      logger: false,
    });

    try {
      // Connect and wait for connection
      await client.connect();
      
      // If successful, logout
      await client.logout();
      
      return new Response(JSON.stringify({ success: true, message: "Connection successful" }), {
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      });
    } catch (err) {
      console.error("Connection failed:", err);
      return new Response(JSON.stringify({ 
        success: false, 
        error: err.message || "Connection failed",
        details: err
      }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
});
