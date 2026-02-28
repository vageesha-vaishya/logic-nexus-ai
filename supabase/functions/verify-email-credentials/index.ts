// @ts-ignore
import { ImapFlow } from "npm:imapflow";
import { getCorsHeaders } from "../_shared/cors.ts";
import { serveWithLogger } from "../_shared/logger.ts";

declare const Deno: any;

serveWithLogger(async (req, logger, _supabase) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }

  try {
    const { imap, smtp } = await req.json();

    if (!imap || !imap.host || !imap.username || !imap.password) {
      throw new Error("Missing IMAP credentials");
    }

    logger.info(`Verifying IMAP connection for ${imap.username} at ${imap.host}:${imap.port}`);

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
    } catch (err: any) {
      logger.error("Connection failed:", { error: err });
      return new Response(JSON.stringify({ 
        success: false, 
        error: err.message || "Connection failed",
        details: err
      }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      });
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
}, "verify-email-credentials");
