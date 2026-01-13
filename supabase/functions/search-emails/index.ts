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
      folder?: string | null;
      page?: number;
      pageSize?: number;
      filterFrom?: string;
      filterTo?: string;
      filterSubject?: string;
      filterHasAttachment?: boolean;
      filterDateFrom?: string;
      filterDateTo?: string;
      groupBy?: "conversation" | "none";
      sortGroupBy?: "date" | "count";
      sortDirection?: "asc" | "desc";
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

    const {
      email,
      query: searchText,
      tenantId,
      accountId,
      direction,
      filterFrom,
      filterTo,
      filterSubject,
      filterHasAttachment,
      filterDateFrom,
      filterDateTo,
      groupBy = "none",
      sortGroupBy = "date",
      sortDirection = "desc",
    } = payload || ({} as SearchPayload);
    let { page = 1, pageSize = 25 } = payload || ({} as SearchPayload);

    if (!email && groupBy !== "conversation") {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required field: email", code: "BAD_REQUEST" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const targetEmail = String(email || "").toLowerCase().trim();

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
    if (payload?.folder) {
      if (payload.folder === "all_mail") {
        dbQuery = dbQuery.neq("folder", "trash").neq("folder", "spam");
      } else if (payload.folder.startsWith("queue_")) {
        const queueName = payload.folder.replace("queue_", "");
        dbQuery = dbQuery.eq("queue", queueName);
      } else {
        dbQuery = dbQuery.eq("folder", payload.folder);
      }
    }

    // 2. Text Search (if provided)
    if (searchText) {
      const q = searchText.trim();
      dbQuery = dbQuery.or(
        `subject.ilike.%${q}%,body_text.ilike.%${q}%,from_name.ilike.%${q}%,from_email.ilike.%${q}%`
      );
    }

    // 3. Advanced filters: from, to, subject, attachments, date range
    if (filterFrom && filterFrom.trim().length > 0) {
      const f = filterFrom.trim();
      dbQuery = dbQuery.ilike("from_email", `%${f}%`);
    }

    if (filterSubject && filterSubject.trim().length > 0) {
      const s = filterSubject.trim();
      dbQuery = dbQuery.ilike("subject", `%${s}%`);
    }

    if (filterHasAttachment) {
      dbQuery = dbQuery.eq("has_attachments", true);
    }

    if (filterDateFrom) {
      const d = new Date(filterDateFrom);
      if (!Number.isNaN(d.getTime())) {
        dbQuery = dbQuery.gte("received_at", d.toISOString());
      }
    }

    if (filterDateTo) {
      const d = new Date(filterDateTo);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        dbQuery = dbQuery.lte("received_at", d.toISOString());
      }
    }

    // 4. Email Address Match (The core requirement)
    // We want emails WHERE:
    //   from_email ILIKE targetEmail
    //   OR to_emails CONTAINS [targetEmail]
    //   OR cc_emails CONTAINS [targetEmail]
    //   OR bcc_emails CONTAINS [targetEmail]
    
    // Note: 'to_emails' is a JSONB array of strings ["a@b.com", "c@d.com"]
    // PostgREST syntax for OR with different operators:
    // or=(col1.op.val,col2.op.val)
    
    const jsonFilter = JSON.stringify([targetEmail]);
    const jsonFilterObject = JSON.stringify([{ email: targetEmail }]);
    const orConditions = [
      `from_email.ilike.%${targetEmail}%`,
      `to_emails.cs.${jsonFilter}`,
      `to_emails.cs.${jsonFilterObject}`,
      `cc_emails.cs.${jsonFilter}`,
      `cc_emails.cs.${jsonFilterObject}`,
      `bcc_emails.cs.${jsonFilter}`,
      `bcc_emails.cs.${jsonFilterObject}`
    ].join(",");

    if (targetEmail) {
      dbQuery = dbQuery.or(orConditions);
    }

    // 5. Ordering and Pagination
    const { data, error, count } = await dbQuery
      .order("received_at", { ascending: false })
      .range(groupBy === "conversation" ? 0 : from, groupBy === "conversation" ? Math.max(200, to) : to);

    if (error) {
      console.error("Query error:", error);
      throw new Error(`Database query error: ${error.message}`);
    }

    if (groupBy === "conversation") {
      const emails = Array.isArray(data) ? data : [];
      const normalizeSubject = (s: string) => s.replace(/^(Re:|Fwd:|FW:|Aw:)\s+/i, "").trim().toLowerCase();
      const groups = new Map<string, { key: string; emails: any[]; latestEmail: any; count: number }>();
      for (const e of emails) {
        const key =
          e.conversation_id ||
          e.thread_id ||
          (typeof e.subject === "string" ? normalizeSubject(e.subject) : "no_subject");
        const g = groups.get(key);
        if (!g) {
          groups.set(key, { key, emails: [e], latestEmail: e, count: 1 });
        } else {
          g.emails.push(e);
          g.count += 1;
          if (new Date(e.received_at).getTime() > new Date(g.latestEmail.received_at).getTime()) {
            g.latestEmail = e;
          }
        }
      }
      let grouped = Array.from(groups.values()).map((g) => ({
        id: g.key,
        count: g.count,
        latestEmail: g.latestEmail,
        emails: g.emails,
      }));
      if (sortGroupBy === "date") {
        grouped = grouped.sort((a, b) => {
          const diff =
            new Date(a.latestEmail.received_at).getTime() -
            new Date(b.latestEmail.received_at).getTime();
          return (sortDirection === "asc" ? 1 : -1) * diff;
        });
      } else if (sortGroupBy === "count") {
        grouped = grouped.sort((a, b) => (sortDirection === "asc" ? 1 : -1) * (a.count - b.count));
      }
      const totalThreads = grouped.length;
      const start = from;
      const end = Math.min(start + pageSize, totalThreads);
      const pageItems = grouped.slice(start, end);
      return new Response(
        JSON.stringify({
          success: true,
          totalThreads,
          page,
          pageSize,
          data: pageItems,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: true,
          count: count,
          page,
          pageSize,
          data: data,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

  } catch (error: unknown) {
    console.error("Error searching emails:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error instanceof Error) ? error.message : String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }
});
