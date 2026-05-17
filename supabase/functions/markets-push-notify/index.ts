/**
 * markets-push-notify — Supabase Edge Function
 *
 * Sends push notifications via Expo Push Service (works for iOS, Android, and
 * PWA via Expo's notification infrastructure).
 *
 * POST /functions/v1/markets-push-notify
 * Body: { user_id: string, title: string, body: string, data?: Record<string, unknown> }
 *
 * Reads push tokens from markets.push_tokens where is_active = true.
 * Sends all tokens in a single batched request to Expo.
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  }

  let payload: { user_id: string; title: string; body: string; data?: Record<string, unknown> };
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400, headers: CORS_HEADERS });
  }

  const { user_id, title, body, data = {} } = payload;
  if (!user_id || !title || !body) {
    return new Response("Missing required fields: user_id, title, body", {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Fetch active push tokens for the user
  const { data: tokens, error: tokensError } = await supabase
    .schema("markets")
    .from("push_tokens")
    .select("token")
    .eq("user_id", user_id)
    .eq("is_active", true);

  if (tokensError) {
    return Response.json(
      { error: tokensError.message },
      { status: 500, headers: CORS_HEADERS },
    );
  }

  if (!tokens?.length) {
    return Response.json({ sent: 0, result: null }, { headers: CORS_HEADERS });
  }

  // Build Expo push messages
  const messages = tokens.map((t: { token: string }) => ({
    to:    t.token,
    title,
    body,
    data,
    sound: "default",
  }));

  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(messages),
  });

  const result = await res.json();

  return Response.json(
    { sent: messages.length, result },
    { headers: CORS_HEADERS },
  );
});
