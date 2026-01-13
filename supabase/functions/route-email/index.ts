const corsHeadersRoute = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const denoRoute = (globalThis as any).Deno;
denoRoute.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeadersRoute });
  }
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeadersRoute, "Content-Type": "application/json" },
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

    let queue = "support_general";
    let sla_minutes = 60;
    if (category === "feedback" && (sentiment === "negative" || sentiment === "very_negative")) {
      queue = "cfm_negative";
      sla_minutes = 30;
    } else if (category === "crm" && sentiment === "very_negative") {
      queue = "support_priority";
      sla_minutes = 15;
    } else if (payload?.intent === "sales") {
      queue = "sales_inbound";
      sla_minutes = 120;
    }

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
      headers: { ...corsHeadersRoute, "Content-Type": "application/json" },
    });
  }
});

