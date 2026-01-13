const corsHeadersClassify = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const deno = (globalThis as any).Deno;
deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeadersClassify });
  }
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeadersClassify, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json().catch(() => ({}));
    const emailId = payload?.email_id as string | undefined;
    if (!emailId) {
      return new Response(JSON.stringify({ error: "Missing email_id" }), {
        status: 400,
        headers: { ...corsHeadersClassify, "Content-Type": "application/json" },
      });
    }

    // Stub classification
    const category = "crm";
    const sentiment = "neutral";
    const intent = "support";

    return new Response(JSON.stringify({ category, sentiment, intent }), {
      status: 200,
      headers: { ...corsHeadersClassify, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as any)?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeadersClassify, "Content-Type": "application/json" },
    });
  }
});
