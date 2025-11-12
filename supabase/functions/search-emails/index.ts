declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};
// @ts-expect-error Supabase Edge (Deno) resolves URL imports at runtime
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

    const supabase = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

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
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, tenantId, accountId, direction } = payload || ({} as SearchPayload);
    let { page = 1, pageSize = 25 } = payload || ({} as SearchPayload);

    if (!email) {
      throw new Error("Missing required field: email");
    }

    const targetEmail = String(email).toLowerCase().trim();

    // Base query builder
    let baseQuery = supabase.from("emails").select("*");
    if (tenantId) baseQuery = baseQuery.eq("tenant_id", tenantId);
    if (accountId) baseQuery = baseQuery.eq("account_id", accountId);
    if (direction) baseQuery = baseQuery.eq("direction", direction);

    // Paging with guardrails
    page = Number(page);
    pageSize = Number(pageSize);
    if (!Number.isFinite(page) || page < 1) page = 1;
    if (!Number.isFinite(pageSize)) pageSize = 25;
    pageSize = Math.max(1, Math.min(100, pageSize));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // 1) From address direct match
    const { data: fromMatches, error: fromErr } = await baseQuery
      .ilike("from_email", `%${targetEmail}%`)
      .order("received_at", { ascending: false })
      .range(from, to);

    if (fromErr) {
      throw new Error(`Query error (from): ${fromErr.message}`);
    }

    // 2) To/CC/BCC contains target
    let toQuery = supabase.from("emails").select("*");
    if (tenantId) toQuery = toQuery.eq("tenant_id", tenantId);
    if (accountId) toQuery = toQuery.eq("account_id", accountId);
    if (direction) toQuery = toQuery.eq("direction", direction);
    const { data: toMatches, error: toErr } = await toQuery.contains("to_emails", [{ email: targetEmail }]);

    let ccQuery = supabase.from("emails").select("*");
    if (tenantId) ccQuery = ccQuery.eq("tenant_id", tenantId);
    if (accountId) ccQuery = ccQuery.eq("account_id", accountId);
    if (direction) ccQuery = ccQuery.eq("direction", direction);
    const { data: ccMatches, error: ccErr } = await ccQuery.contains("cc_emails", [{ email: targetEmail }]);

    let bccQuery = supabase.from("emails").select("*");
    if (tenantId) bccQuery = bccQuery.eq("tenant_id", tenantId);
    if (accountId) bccQuery = bccQuery.eq("account_id", accountId);
    if (direction) bccQuery = bccQuery.eq("direction", direction);
    const { data: bccMatches, error: bccErr } = await bccQuery.contains("bcc_emails", [{ email: targetEmail }]);

    if (toErr || ccErr || bccErr) {
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
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});