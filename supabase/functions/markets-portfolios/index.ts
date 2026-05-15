// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../types.d.ts" />

// Markets portfolios edge function — full CRUD on markets.portfolios.
//
// GET    /markets-portfolios            → list authenticated user's portfolios
// POST   /markets-portfolios            → create  (x-tenant-id, x-franchise-id required)
// PATCH  /markets-portfolios            → update  { id, name?, description?, mode?,
//                                                    base_currency?, holder_type?,
//                                                    contact_id?, account_id? }
// DELETE /markets-portfolios            → delete  { id }
//
// Per design doc 2026-05-14 §6.2 + §16.

import { serveWithLogger } from "../_shared/logger.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { checkDomainAccess, PlatformDomains } from "../_shared/domain-access.ts";

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const SELECT_FIELDS =
  "id, name, description, mode, base_currency, holder_type, contact_id, account_id, managed_by, is_active, metadata, created_at, updated_at";

const VALID_HOLDER_TYPES = ["individual", "huf", "corporate", "joint", "self_directed"] as const;

serveWithLogger(async (req, logger, supabaseAdmin) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const { user, error: authError, supabaseClient } = await requireAuth(req, logger);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: authError ?? "Unauthorized" }),
        { status: 401, headers: jsonHeaders },
      );
    }

    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: "Missing x-tenant-id header" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const access = await checkDomainAccess(supabaseAdmin, tenantId, PlatformDomains.MARKETS);
    if (!access.allowed) {
      logger.warn("markets domain access denied", { user_id: user.id, tenant_id: tenantId, reason: access.reason });
      return new Response(
        JSON.stringify({ error: "Tenant does not have the markets domain enabled", reason: access.reason }),
        { status: 403, headers: jsonHeaders },
      );
    }

    const marketsDb = supabaseClient.schema("markets" as any);

    // ── GET: list portfolios ─────────────────────────────────────────────
    if (req.method === "GET") {
      const { data, error } = await marketsDb
        .from("portfolios" as any)
        .select(SELECT_FIELDS)
        .order("created_at", { ascending: false });

      if (error) {
        logger.error("list portfolios failed", { error: error.message, user_id: user.id });
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: jsonHeaders });
      }
      return new Response(JSON.stringify({ data, count: data?.length ?? 0 }), { headers: jsonHeaders });
    }

    // ── POST: create portfolio ───────────────────────────────────────────
    if (req.method === "POST") {
      const franchiseId = req.headers.get("x-franchise-id");
      if (!franchiseId) {
        return new Response(JSON.stringify({ error: "Missing x-franchise-id header" }), { status: 400, headers: jsonHeaders });
      }

      let body: any;
      try { body = await req.json(); } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: jsonHeaders });
      }

      const name = typeof body?.name === "string" ? body.name.trim() : "";
      if (!name) {
        return new Response(JSON.stringify({ error: "name is required" }), { status: 400, headers: jsonHeaders });
      }

      const mode = body?.mode === "live" ? "live" : "paper";
      const baseCurrency =
        typeof body?.base_currency === "string" && body.base_currency.length === 3
          ? body.base_currency.toUpperCase() : "INR";
      const description = typeof body?.description === "string" ? body.description.trim() || null : null;

      const holderType: string =
        typeof body?.holder_type === "string" && (VALID_HOLDER_TYPES as readonly string[]).includes(body.holder_type)
          ? body.holder_type : "self_directed";

      const contactId: string | null = typeof body?.contact_id === "string" ? body.contact_id : null;
      const accountId: string | null = typeof body?.account_id === "string" ? body.account_id : null;

      if (holderType !== "self_directed" && (!contactId || !accountId)) {
        return new Response(
          JSON.stringify({ error: `holder_type '${holderType}' requires both contact_id and account_id` }),
          { status: 400, headers: jsonHeaders },
        );
      }

      if (contactId && accountId) {
        const { data: contactCheck, error: contactErr } = await (supabaseAdmin as any)
          .from("contacts").select("id").eq("id", contactId).eq("account_id", accountId).maybeSingle();
        if (contactErr || !contactCheck) {
          return new Response(
            JSON.stringify({ error: "Contact does not belong to the specified account" }),
            { status: 400, headers: jsonHeaders },
          );
        }
      }

      const { data, error } = await marketsDb
        .from("portfolios" as any)
        .insert({
          tenant_id: tenantId, franchise_id: franchiseId, owner_user_id: user.id, managed_by: user.id,
          name, description, mode, base_currency: baseCurrency, holder_type: holderType,
          contact_id: contactId, account_id: accountId,
        } as any)
        .select(SELECT_FIELDS)
        .single();

      if (error) {
        logger.error("create portfolio failed", { error: error.message, user_id: user.id, tenant_id: tenantId });
        const status = error.code === "42501" ? 403 : 400;
        return new Response(JSON.stringify({ error: error.message, code: error.code }), { status, headers: jsonHeaders });
      }
      return new Response(JSON.stringify({ data }), { status: 201, headers: jsonHeaders });
    }

    // ── PATCH: update portfolio ──────────────────────────────────────────
    if (req.method === "PATCH") {
      let body: any;
      try { body = await req.json(); } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: jsonHeaders });
      }

      const id = typeof body?.id === "string" ? body.id.trim() : "";
      if (!id) {
        return new Response(JSON.stringify({ error: "id is required" }), { status: 400, headers: jsonHeaders });
      }

      const updates: Record<string, any> = {};

      if (typeof body?.name === "string") {
        const name = body.name.trim();
        if (!name) return new Response(JSON.stringify({ error: "name cannot be empty" }), { status: 400, headers: jsonHeaders });
        updates.name = name;
      }
      if ("description" in body) {
        updates.description = typeof body.description === "string" ? body.description.trim() || null : null;
      }
      if (body?.mode === "live" || body?.mode === "paper") updates.mode = body.mode;
      if (typeof body?.base_currency === "string" && body.base_currency.length === 3) {
        updates.base_currency = body.base_currency.toUpperCase();
      }

      const holderType = body?.holder_type;
      if (holderType !== undefined) {
        if (!(VALID_HOLDER_TYPES as readonly string[]).includes(holderType)) {
          return new Response(JSON.stringify({ error: `Invalid holder_type: ${holderType}` }), { status: 400, headers: jsonHeaders });
        }
        updates.holder_type = holderType;
      }

      // Handle contact/account changes
      const newContactId = "contact_id" in body ? (typeof body.contact_id === "string" ? body.contact_id : null) : undefined;
      const newAccountId = "account_id" in body ? (typeof body.account_id === "string" ? body.account_id : null) : undefined;

      if (newContactId !== undefined) updates.contact_id = newContactId;
      if (newAccountId !== undefined) updates.account_id = newAccountId;

      // Validate managed type requires contact + account
      const effectiveHolderType = updates.holder_type ?? body?.existing_holder_type;
      if (effectiveHolderType && effectiveHolderType !== "self_directed") {
        const effectiveContact = updates.contact_id ?? newContactId;
        const effectiveAccount = updates.account_id ?? newAccountId;
        if (effectiveContact === null || effectiveAccount === null) {
          return new Response(
            JSON.stringify({ error: `holder_type '${effectiveHolderType}' requires both contact_id and account_id` }),
            { status: 400, headers: jsonHeaders },
          );
        }
      }

      // Validate contact ↔ account relationship if both being set
      const checkContact = updates.contact_id;
      const checkAccount = updates.account_id;
      if (checkContact && checkAccount) {
        const { data: contactCheck, error: contactErr } = await (supabaseAdmin as any)
          .from("contacts").select("id").eq("id", checkContact).eq("account_id", checkAccount).maybeSingle();
        if (contactErr || !contactCheck) {
          return new Response(
            JSON.stringify({ error: "Contact does not belong to the specified account" }),
            { status: 400, headers: jsonHeaders },
          );
        }
      }

      if (Object.keys(updates).length === 0) {
        return new Response(JSON.stringify({ error: "No updatable fields provided" }), { status: 400, headers: jsonHeaders });
      }

      const { data, error } = await marketsDb
        .from("portfolios" as any)
        .update(updates as any)
        .eq("id", id)
        .select(SELECT_FIELDS)
        .single();

      if (error) {
        logger.error("update portfolio failed", { error: error.message, user_id: user.id, id });
        const status = error.code === "42501" ? 403 : error.code === "PGRST116" ? 404 : 400;
        return new Response(JSON.stringify({ error: error.message, code: error.code }), { status, headers: jsonHeaders });
      }
      return new Response(JSON.stringify({ data }), { headers: jsonHeaders });
    }

    // ── DELETE: delete portfolio ─────────────────────────────────────────
    if (req.method === "DELETE") {
      let body: any;
      try { body = await req.json(); } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: jsonHeaders });
      }

      const id = typeof body?.id === "string" ? body.id.trim() : "";
      if (!id) {
        return new Response(JSON.stringify({ error: "id is required" }), { status: 400, headers: jsonHeaders });
      }

      const { error } = await marketsDb
        .from("portfolios" as any)
        .delete()
        .eq("id", id);

      if (error) {
        logger.error("delete portfolio failed", { error: error.message, user_id: user.id, id });
        const status = error.code === "42501" ? 403 : 400;
        return new Response(JSON.stringify({ error: error.message, code: error.code }), { status, headers: jsonHeaders });
      }
      return new Response(JSON.stringify({ success: true }), { headers: jsonHeaders });
    }

    return new Response(
      JSON.stringify({ error: `Method ${req.method} not allowed` }),
      { status: 405, headers: { ...jsonHeaders, Allow: "GET, POST, PATCH, DELETE, OPTIONS" } },
    );
  } catch (e: any) {
    logger.error("markets-portfolios unhandled error", { error: e?.message ?? String(e) });
    return new Response(
      JSON.stringify({ error: e?.message ?? "Internal server error" }),
      { status: 500, headers: jsonHeaders },
    );
  }
}, "markets-portfolios");
