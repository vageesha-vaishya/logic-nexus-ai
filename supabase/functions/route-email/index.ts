import { determineRoute } from '../_shared/routing-logic.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';

const denoRoute = (globalThis as any).Deno;
denoRoute.serve(async (req: Request) => {
  const corsHeadersRoute = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeadersRoute });
  }

  // Auth: require authenticated user
  const { user, error: authError } = await requireAuth(req);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeadersRoute, 'Content-Type': 'application/json' } });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeadersRoute, "Content-Type": "application/json", "Content-Language": "en" },
      });
    }

    const payload = await req.json().catch(() => ({}));
    const emailId = payload?.email_id as string | undefined;
    const category = payload?.category as string | undefined;
    const sentiment = payload?.sentiment as string | undefined;
    if (!emailId || !category || !sentiment) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeadersRoute, "Content-Type": "application/json" },
      });
    }

    const { queue, sla_minutes } = determineRoute({
      category,
      sentiment,
      intent: payload?.intent
    });

    return new Response(JSON.stringify({
      queue,
      sla_minutes,
      notifications: []
    }), {
      status: 200,
      headers: { ...corsHeadersRoute, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as any)?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeadersRoute, "Content-Type": "application/json", "Content-Language": "en" },
    });
  }
});

