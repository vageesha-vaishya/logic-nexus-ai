declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requireEnv = (name: string) => {
      const v = Deno.env.get(name);
      if (!v) throw new Error(`Missing environment variable: ${name}`);
      return v;
    };

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing Authorization header", code: "AUTH_REQUIRED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_ANON_KEY"), {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    type SearchPayload = {
      email: string;
      tenantId?: string | null;
      accountId?: string | null;
      direction?: string | null;
      page?: number;
      pageSize?: number;
    };
    let payload: SearchPayload | null;
    try {
      payload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body", code: "BAD_REQUEST" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, tenantId, accountId, direction } = payload || ({} as SearchPayload);
    let { page = 1, pageSize = 25 } = payload || ({} as SearchPayload);

    if (!email) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required field: email", code: "BAD_REQUEST" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const targetEmail = String(email).toLowerCase().trim();

    // Paging with guardrails
    page = Number(page);
    pageSize = Number(pageSize);
    if (!Number.isFinite(page) || page < 1) page = 1;
    if (!Number.isFinite(pageSize)) pageSize = 25;
    pageSize = Math.max(1, Math.min(100, pageSize));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Helper to build base query with filters
    const buildQuery = () => {
      let q = supabase.from("emails").select("*");
      if (tenantId) q = q.eq("tenant_id", tenantId);
      if (accountId) q = q.eq("account_id", accountId);
      if (direction) q = q.eq("direction", direction);
      return q;
    };

    // 1) From address direct match
    const { data: fromMatches, error: fromErr } = await buildQuery()
      .ilike("from_email", `%${targetEmail}%`)
      .order("received_at", { ascending: false })
      .range(from, to);

    if (fromErr) {
      throw new Error(`Query error (from): ${fromErr.message}`);
    }

    // 2) Search in to_emails, cc_emails, bcc_emails using text search
    // The columns contain JSONB arrays like [{ email: "...", name: "..." }]
    // Use filter with @> operator for JSONB containment
    const jsonFilter = JSON.stringify([{ email: targetEmail }]);
    
    const { data: toMatches, error: toErr } = await buildQuery()
      .filter("to_emails", "cs", jsonFilter)
      .order("received_at", { ascending: false })
      .range(from, to);

    const { data: ccMatches, error: ccErr } = await buildQuery()
      .filter("cc_emails", "cs", jsonFilter)
      .order("received_at", { ascending: false })
      .range(from, to);

    const { data: bccMatches, error: bccErr } = await buildQuery()
      .filter("bcc_emails", "cs", jsonFilter)
      .order("received_at", { ascending: false })
      .range(from, to);

    if (toErr || ccErr || bccErr) {
      console.error("Query errors:", { toErr, ccErr, bccErr });
      throw new Error(
        `Query error (recipients): ${toErr?.message || ccErr?.message || bccErr?.message}`
      );
    }

    // Merge and de-duplicate by id
    const byId: Record<string, unknown> = {};
    for (const arr of [fromMatches || [], toMatches || [], ccMatches || [], bccMatches || []]) {
      for (const e of arr as unknown[]) {
        const id = (e as { id?: string })?.id;
        if (id) byId[id] = e;
      }
    }
    const toReceivedAt = (x: unknown): number => {
      const v = (x as { received_at?: string })?.received_at;
      return v ? new Date(v).getTime() : 0;
    };
    const merged = Object.values(byId).sort((a, b) => toReceivedAt(b) - toReceivedAt(a));

    return new Response(
      JSON.stringify({
        success: true,
        count: merged.length,
        data: merged.slice(0, pageSize),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    console.error("Error searching emails:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error instanceof Error) ? error.message : String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }
});
