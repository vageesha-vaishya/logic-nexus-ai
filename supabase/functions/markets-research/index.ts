// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../types.d.ts" />

// markets-research — Research Thread CRUD + AI message exchange
//
// GET  ?path=threads                    → list threads for user
// POST ?path=threads  { title?, context_type?, context_ref_id? }
//                                       → create thread
// GET  ?path=messages&thread_id=<id>    → list messages for thread
// POST ?path=message  { thread_id, content }
//                                       → send message, get AI response, persist both
//
// All requests require auth (JWT or service-account key).
// RLS scopes threads + messages to owner_user_id = auth.uid().

import { serveWithLogger }          from "../_shared/logger.ts";
import { corsHeaders, preflight, apiHeaders } from "../_shared/cors.ts";
import { requireAuth }              from "../_shared/auth.ts";
import { checkDomainAccess, PlatformDomains } from "../_shared/domain-access.ts";
import { logAccess, logAudit, extractIp, extractRequestId } from "../_shared/audit.ts";
import { checkRateLimit, rlKey, rateLimitResponse, POLICIES } from "../_shared/rate-limit.ts";
import { callLLMConversation, type LlmTaskId } from "../_shared/llm-gateway.ts";

declare const Deno: any;

const DOMAIN = "markets";
const THREAD_MSG_LIMIT = 30;   // context window: last N messages sent to LLM

serveWithLogger(async (req, logger, supabaseAdmin) => {
  const pre = preflight(req);
  if (pre) return pre;

  const requestId = extractRequestId(req);
  const ip        = extractIp(req);
  const t0        = Date.now();
  const url       = new URL(req.url);
  const path      = url.searchParams.get("path") ?? "";

  try {
    const { user, error: authError, supabaseClient } = await requireAuth(req, logger);
    if (authError || !user) {
      logAccess(supabaseAdmin, { requestId, domain: DOMAIN, op: `${req.method} /markets-research`, decision: "deny", reason: "unauthorized" });
      return new Response(JSON.stringify({ error: authError ?? "Unauthorized" }), { status: 401, headers: apiHeaders(requestId) });
    }

    const tenantId   = req.headers.get("x-tenant-id");
    const franchiseId = req.headers.get("x-franchise-id");

    if (!tenantId) {
      return new Response(JSON.stringify({ error: "Missing x-tenant-id header" }), { status: 400, headers: apiHeaders(requestId) });
    }

    const access = await checkDomainAccess(supabaseAdmin, tenantId, PlatformDomains.MARKETS);
    if (!access.allowed) {
      logAccess(supabaseAdmin, { requestId, domain: DOMAIN, op: `${req.method} /markets-research`, userId: user.id, tenantId, decision: "deny", reason: access.reason ?? "domain_not_enabled" });
      return new Response(JSON.stringify({ error: "Markets domain not enabled", reason: access.reason }), { status: 403, headers: apiHeaders(requestId) });
    }

    logAccess(supabaseAdmin, { requestId, domain: DOMAIN, op: `${req.method} /markets-research?path=${path}`, userId: user.id, tenantId, decision: "allow", ms: Date.now() - t0 });

    const rl = await checkRateLimit(
      rlKey(`research.${path}`, tenantId, user.id),
      path === "message" ? POLICIES.llm_call : POLICIES.api_read,
    );
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

    const marketsDb = (supabaseClient as any).schema("markets");
    const h = apiHeaders(requestId);

    // ── GET threads ────────────────────────────────────────────────────────
    if (path === "threads" && req.method === "GET") {
      const { data, error } = await marketsDb
        .from("research_threads")
        .select("id, title, status, context_type, context_ref_id, message_count, last_message_at, created_at, updated_at")
        .eq("status", "active")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        logger.error("research.list_threads_failed", { error: error.message });
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: h });
      }
      return new Response(JSON.stringify({ data: data ?? [] }), { headers: h });
    }

    // ── POST threads (create) ──────────────────────────────────────────────
    if (path === "threads" && req.method === "POST") {
      let body: any;
      try { body = await req.json(); } catch { body = {}; }

      const { data, error } = await marketsDb
        .from("research_threads")
        .insert({
          tenant_id:      tenantId,
          franchise_id:   franchiseId,
          owner_user_id:  user.id,
          title:          typeof body?.title === "string" ? body.title.trim() || "New research thread" : "New research thread",
          context_type:   body?.context_type ?? null,
          context_ref_id: body?.context_ref_id ?? null,
          status:         "active",
        })
        .select("id, title, status, context_type, context_ref_id, message_count, last_message_at, created_at")
        .single();

      if (error) {
        logger.error("research.create_thread_failed", { error: error.message });
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: h });
      }

      logAudit(supabaseAdmin, { requestId, domain: DOMAIN, op: "POST /markets-research?path=threads", tenantId, userId: user.id, ip, resourceType: "research_thread", resourceId: data.id, action: "create", after: data });
      return new Response(JSON.stringify({ data }), { status: 201, headers: h });
    }

    // ── GET messages ───────────────────────────────────────────────────────
    if (path === "messages" && req.method === "GET") {
      const threadId = url.searchParams.get("thread_id");
      if (!threadId) return new Response(JSON.stringify({ error: "thread_id required" }), { status: 400, headers: h });

      const { data, error } = await marketsDb
        .from("research_messages")
        .select("id, role, content, citations, sequence_num, is_error, llm_model, input_tokens, output_tokens, cost_usd, created_at")
        .eq("thread_id", threadId)
        .order("sequence_num", { ascending: true })
        .limit(200);

      if (error) {
        logger.error("research.list_messages_failed", { error: error.message });
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: h });
      }
      return new Response(JSON.stringify({ data: data ?? [] }), { headers: h });
    }

    // ── POST message (send + get AI response) ──────────────────────────────
    if (path === "message" && req.method === "POST") {
      let body: any;
      try { body = await req.json(); } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: h });
      }

      const threadId = typeof body?.thread_id === "string" ? body.thread_id : null;
      const content  = typeof body?.content   === "string" ? body.content.trim() : "";

      if (!threadId) return new Response(JSON.stringify({ error: "thread_id required" }), { status: 400, headers: h });
      if (!content)  return new Response(JSON.stringify({ error: "content required"   }), { status: 400, headers: h });

      // Verify thread ownership
      const { data: thread, error: threadErr } = await marketsDb
        .from("research_threads")
        .select("id, title, context_type, context_ref_id, owner_user_id")
        .eq("id", threadId)
        .maybeSingle();

      if (threadErr || !thread) return new Response(JSON.stringify({ error: "Thread not found" }), { status: 404, headers: h });
      if (thread.owner_user_id !== user.id) return new Response(JSON.stringify({ error: "Not your thread" }), { status: 403, headers: h });

      // Load recent conversation history
      const { data: history } = await marketsDb
        .from("research_messages")
        .select("role, content")
        .eq("thread_id", threadId)
        .order("sequence_num", { ascending: false })
        .limit(THREAD_MSG_LIMIT);

      const priorMessages: Array<{ role: string; content: string }> =
        ((history ?? []) as any[]).reverse();

      // Build context note if portfolio-scoped thread
      let contextNote = "";
      if (thread.context_type === "portfolio" && thread.context_ref_id) {
        const portfolioId = thread.context_ref_id;
        const { data: holdings } = await (supabaseAdmin as any).schema("markets")
          .from("holdings")
          .select("qty, avg_cost, instruments(symbol, exchange)")
          .eq("portfolio_id", portfolioId)
          .limit(30);

        if (holdings?.length) {
          const symbols = (holdings as any[])
            .map((h: any) => h.instruments?.symbol)
            .filter(Boolean)
            .join(", ");
          contextNote = `Portfolio context: ${holdings.length} holdings including ${symbols.slice(0, 200)}.`;
        }
      }

      // Persist user message first (triggers sequence_num auto-assign)
      await marketsDb.from("research_messages").insert({
        thread_id:     threadId,
        tenant_id:     tenantId,
        franchise_id:  franchiseId,
        owner_user_id: user.id,
        role:          "user",
        content:       content,
      });

      // Call LLM via shared gateway with full conversation history
      let llmResult: any;
      try {
        const conversationMessages = [...priorMessages, { role: "user" as const, content }];
        llmResult = await callLLMConversation(
          "markets.research_thread" as LlmTaskId,
          conversationMessages,
          {
            tenantId:     tenantId,
            franchiseId:  franchiseId ?? null,
            userId:       user.id,
            supabaseAdmin,
            requestId,
            logger,
          },
          contextNote || undefined,
        );
      } catch (llmErr: any) {
        logger.error("research.llm_failed", { error: llmErr?.message });
        await marketsDb.from("research_messages").insert({
          thread_id: threadId, tenant_id: tenantId, franchise_id: franchiseId,
          owner_user_id: user.id, role: "assistant",
          content: `I encountered an error: ${llmErr?.message ?? "unknown error"}. Please try again.`,
          is_error: true,
        });
        return new Response(JSON.stringify({ error: llmErr?.message ?? "LLM call failed" }), { status: 502, headers: h });
      }

      // Persist assistant response
      const { data: assistantMsg } = await marketsDb
        .from("research_messages")
        .insert({
          thread_id:     threadId,
          tenant_id:     tenantId,
          franchise_id:  franchiseId,
          owner_user_id: user.id,
          role:          "assistant",
          content:       llmResult.text,
          llm_provider:  llmResult.provider,
          llm_model:     llmResult.model,
          input_tokens:  llmResult.inputTokens  ?? 0,
          output_tokens: llmResult.outputTokens ?? 0,
          cost_usd:      llmResult.costUsd      ?? 0,
        })
        .select("id, role, content, llm_model, input_tokens, output_tokens, cost_usd, sequence_num, created_at")
        .single();

      logger.info("research.message_ok", {
        thread_id:    threadId,
        input_tokens: llmResult.inputTokens,
        output_tokens: llmResult.outputTokens,
        cost_usd:     llmResult.costUsd,
      });

      return new Response(JSON.stringify({ data: assistantMsg }), { headers: h });
    }

    // ── PATCH thread (rename / archive) ────────────────────────────────────
    if (path === "threads" && req.method === "PATCH") {
      let body: any;
      try { body = await req.json(); } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: h });
      }

      const threadId = typeof body?.id === "string" ? body.id : null;
      if (!threadId) return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: h });

      const updates: Record<string, any> = {};
      if (typeof body?.title === "string") updates.title = body.title.trim();
      if (body?.status === "archived") updates.status = "archived";
      if (Object.keys(updates).length === 0) return new Response(JSON.stringify({ error: "No fields to update" }), { status: 400, headers: h });

      const { data, error } = await marketsDb
        .from("research_threads").update(updates).eq("id", threadId).select("id, title, status").single();

      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: h });
      return new Response(JSON.stringify({ data }), { headers: h });
    }

    return new Response(
      JSON.stringify({ error: `Unknown path: ${path} (${req.method})` }),
      { status: 404, headers: h },
    );

  } catch (e: any) {
    logger.error("markets-research unhandled error", { error: e?.message });
    return new Response(JSON.stringify({ error: e?.message ?? "Internal server error" }), { status: 500, headers: apiHeaders(requestId) });
  }
}, "markets-research");
