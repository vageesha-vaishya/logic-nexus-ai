// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../types.d.ts" />

// First markets-domain edge function — validates the full auth chain:
//   JWT → user → domain-access (tenant_domain_assignments) → RLS-gated CRUD on markets.portfolios
//
// GET  /markets-portfolios            → list the authenticated user's portfolios
// POST /markets-portfolios { name, description?, mode?, base_currency?,
//                            holder_type?, contact_id?, account_id? }
//                                     → create a portfolio (needs x-tenant-id, x-franchise-id headers)
//
// Per design doc 2026-05-14 §6.2 + §16 platform-scale review.

import { serveWithLogger } from "../_shared/logger.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { checkDomainAccess, PlatformDomains } from "../_shared/domain-access.ts";

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

serveWithLogger(async (req, logger, supabaseAdmin) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    // 1. Authenticate the request — supabaseClient is JWT-scoped (RLS applies).
    const { user, error: authError, supabaseClient } = await requireAuth(req, logger);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: authError ?? "Unauthorized" }),
        { status: 401, headers: jsonHeaders },
      );
    }

    // 2. Tenant context comes from x-tenant-id header (set by frontend per active tenant).
    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: "Missing x-tenant-id header" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    // 3. Domain-access gate — does this tenant have the markets domain enabled?
    //    Uses supabaseAdmin so this authorization check itself isn't RLS-gated.
    const access = await checkDomainAccess(supabaseAdmin, tenantId, PlatformDomains.MARKETS);
    if (!access.allowed) {
      logger.warn("markets domain access denied", {
        user_id: user.id,
        tenant_id: tenantId,
        reason: access.reason,
      });
      return new Response(
        JSON.stringify({
          error: `Tenant does not have the markets domain enabled`,
          reason: access.reason,
        }),
        { status: 403, headers: jsonHeaders },
      );
    }

    // 4. Route by HTTP method. Body/data ops happen via the JWT-scoped client so
    //    markets.portfolios RLS (owner_user_id = auth.uid()) enforces ownership.
    const marketsDb = supabaseClient.schema("markets" as any);

    if (req.method === "GET") {
      const { data, error } = await marketsDb
        .from("portfolios" as any)
        .select(
          "id, name, description, mode, base_currency, holder_type, contact_id, account_id, managed_by, is_active, metadata, created_at, updated_at",
        )
        .order("created_at", { ascending: false });

      if (error) {
        logger.error("list portfolios failed", { error: error.message, user_id: user.id });
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: jsonHeaders },
        );
      }
      return new Response(
        JSON.stringify({ data, count: data?.length ?? 0 }),
        { headers: jsonHeaders },
      );
    }

    if (req.method === "POST") {
      const franchiseId = req.headers.get("x-franchise-id");
      if (!franchiseId) {
        return new Response(
          JSON.stringify({ error: "Missing x-franchise-id header" }),
          { status: 400, headers: jsonHeaders },
        );
      }

      let body: any;
      try {
        body = await req.json();
      } catch {
        return new Response(
          JSON.stringify({ error: "Invalid JSON body" }),
          { status: 400, headers: jsonHeaders },
        );
      }

      const name = typeof body?.name === "string" ? body.name.trim() : "";
      if (!name) {
        return new Response(
          JSON.stringify({ error: "name is required (non-empty string)" }),
          { status: 400, headers: jsonHeaders },
        );
      }

      const mode = body?.mode === "live" ? "live" : "paper";
      const baseCurrency =
        typeof body?.base_currency === "string" && body.base_currency.length === 3
          ? body.base_currency.toUpperCase()
          : "INR";
      const description = typeof body?.description === "string" ? body.description : null;

      const VALID_HOLDER_TYPES = ["individual","huf","corporate","joint","self_directed"];
      const holderType: string =
        typeof body?.holder_type === "string" && VALID_HOLDER_TYPES.includes(body.holder_type)
          ? body.holder_type
          : "self_directed";

      const contactId: string | null =
        typeof body?.contact_id === "string" ? body.contact_id : null;
      const accountId: string | null =
        typeof body?.account_id === "string" ? body.account_id : null;

      // Managed portfolios require both contact and account.
      if (holderType !== "self_directed" && (!contactId || !accountId)) {
        return new Response(
          JSON.stringify({
            error: `holder_type '${holderType}' requires both contact_id and account_id`,
          }),
          { status: 400, headers: jsonHeaders },
        );
      }

      // Validate contact belongs to the account (guard against mismatched IDs).
      if (contactId && accountId) {
        const { data: contactCheck, error: contactErr } = await (supabaseAdmin as any)
          .from("contacts")
          .select("id")
          .eq("id", contactId)
          .eq("account_id", accountId)
          .maybeSingle();
        if (contactErr || !contactCheck) {
          return new Response(
            JSON.stringify({ error: "Contact does not belong to the specified account" }),
            { status: 400, headers: jsonHeaders },
          );
        }
      }

      const insertRow = {
        tenant_id: tenantId,
        franchise_id: franchiseId,
        owner_user_id: user.id,
        managed_by: user.id,
        name,
        description,
        mode,
        base_currency: baseCurrency,
        holder_type: holderType,
        contact_id: contactId,
        account_id: accountId,
      };

      const { data, error } = await marketsDb
        .from("portfolios" as any)
        .insert(insertRow as any)
        .select(
          "id, name, description, mode, base_currency, holder_type, contact_id, account_id, managed_by, is_active, metadata, created_at, updated_at",
        )
        .single();

      if (error) {
        logger.error("create portfolio failed", {
          error: error.message,
          user_id: user.id,
          tenant_id: tenantId,
        });
        // 23xxx and 42501 are typical RLS/constraint errors → 400/403
        const status = error.code === "42501" ? 403 : 400;
        return new Response(
          JSON.stringify({ error: error.message, code: error.code }),
          { status, headers: jsonHeaders },
        );
      }

      return new Response(
        JSON.stringify({ data }),
        { status: 201, headers: jsonHeaders },
      );
    }

    return new Response(
      JSON.stringify({ error: `Method ${req.method} not allowed` }),
      { status: 405, headers: { ...jsonHeaders, Allow: "GET, POST, OPTIONS" } },
    );
  } catch (e: any) {
    logger.error("markets-portfolios unhandled error", { error: e?.message ?? String(e) });
    return new Response(
      JSON.stringify({ error: e?.message ?? "Internal server error" }),
      { status: 500, headers: jsonHeaders },
    );
  }
}, "markets-portfolios");
