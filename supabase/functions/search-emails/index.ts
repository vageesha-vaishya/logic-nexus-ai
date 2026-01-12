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
      query?: string;
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

    const { email, query: searchText, tenantId, accountId, direction } = payload || ({} as SearchPayload);
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

    let dbQuery = supabase.from("emails").select("*", { count: "exact" });

    // 1. Scope filters
    if (tenantId) dbQuery = dbQuery.eq("tenant_id", tenantId);
    if (accountId) dbQuery = dbQuery.eq("account_id", accountId);
    if (direction) dbQuery = dbQuery.eq("direction", direction);

    // 2. Text Search (if provided)
    if (searchText) {
      const q = searchText.trim();
      // Simple OR search across common fields
      dbQuery = dbQuery.or(`subject.ilike.%${q}%,body_text.ilike.%${q}%,from_name.ilike.%${q}%,from_email.ilike.%${q}%`);
    }

    // 3. Email Address Match (The core requirement)
    // We want emails WHERE:
    //   from_email ILIKE targetEmail
    //   OR to_emails CONTAINS [targetEmail]
    //   OR cc_emails CONTAINS [targetEmail]
    //   OR bcc_emails CONTAINS [targetEmail]
    
    // Note: 'to_emails' is a JSONB array of strings ["a@b.com", "c@d.com"]
    // PostgREST syntax for OR with different operators:
    // or=(col1.op.val,col2.op.val)
    
    const jsonFilter = JSON.stringify([targetEmail]);
    const orConditions = [
      `from_email.ilike.%${targetEmail}%`,
      `to_emails.cs.${jsonFilter}`,
      `cc_emails.cs.${jsonFilter}`,
      `bcc_emails.cs.${jsonFilter}`
    ].join(",");

    dbQuery = dbQuery.or(orConditions);

    // 4. Ordering and Pagination
    const { data, error, count } = await dbQuery
      .order("received_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("Query error:", error);
      throw new Error(`Database query error: ${error.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: count,
        data: data,
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
