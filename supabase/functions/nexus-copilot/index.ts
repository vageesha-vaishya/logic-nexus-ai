import { serveWithLogger } from "../_shared/logger.ts";
import { requireAuth } from "../_shared/auth.ts";
import { sanitizeForLLM } from "../_shared/pii-guard.ts";
import { pickEmbeddingModel } from "../_shared/model-router.ts";
import { logAiCall } from "../_shared/audit.ts";
import { callLLM, LlmCallContext } from "../_shared/llm-gateway.ts";

type CopilotRequest = {
  query: string;
  tenantId?: string | null;
  topK?: number;
  threshold?: number;
};

serveWithLogger(async (req, logger, supabaseAdmin) => {
  try {
    const { user, error: authError, supabaseClient } = await requireAuth(req);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    let payload: CopilotRequest | null;
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const query = payload?.query?.trim();
    if (!query) {
      return new Response(JSON.stringify({ error: "Missing query" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { sanitized, redacted } = sanitizeForLLM(query);

    const supabase = supabaseClient;

    // RAG lookup is best-effort. pickEmbeddingModel() is OpenAI-only with
    // no fallback, and OPENAI_API_KEY in this environment is currently
    // dead (confirmed live, see docs/audits/2026-09-05-ai-llm-audit-findings.md
    // §8) -- so this fails every time today. On failure, degrade to "no
    // context found" rather than throwing: a different embedding provider
    // (e.g. Gemini, already used as this function's chat fallback) would
    // return a real vector with no error, but in a completely different
    // embedding space than the one knowledge_base's existing rows were
    // embedded in -- confirmed same dimension count (1536) but a
    // different model's vector space, so cosine similarity against it
    // would be semantically meaningless, not just lower-quality. A
    // silently wrong match is worse than no match; the chat prompt already
    // instructs the model to say so when context is insufficient.
    let matches: any[] = [];
    try {
      const { model, url, headers: embHeaders } = pickEmbeddingModel();
      const embRes = await fetch(url, {
        method: "POST",
        headers: embHeaders,
        body: JSON.stringify({ input: sanitized, model }),
      });
      if (!embRes.ok) {
        throw new Error(`Embedding error: ${await embRes.text()}`);
      }
      const embJson = await embRes.json();
      const embedding = embJson?.data?.[0]?.embedding;
      if (!Array.isArray(embedding)) throw new Error("No embedding returned");

      const topK = Math.min(Math.max(payload?.topK ?? 8, 1), 50);
      const threshold = payload?.threshold ?? 0.2;

      const { data, error: matchErr } = await supabase.rpc("match_documents_scoped", {
        query_embedding: embedding,
        similarity_threshold: threshold,
        match_count: topK,
        tenant_id: payload?.tenantId ?? null,
      });
      if (matchErr) throw matchErr;
      matches = data || [];
    } catch (err) {
      logger.warn("Nexus copilot RAG lookup unavailable, answering without context", { error: err });
    }

    const context = matches
      .map((m: any, i: number) => `# Doc ${i + 1}\nTitle: ${m.title}\nContent:\n${m.content}`)
      .join("\n\n");

    // Routes through the shared LLM gateway (tenant-configured provider,
    // self-hosted by default; falls back only if that fails -- see
    // _shared/llm-gateway.ts).
    const ctx: LlmCallContext = { tenantId: payload?.tenantId ?? null, userId: user?.id ?? null, supabaseAdmin, logger };
    const llmResult = await callLLM("comms.nexus_copilot_chat", { context, question: sanitized }, ctx);
    const answer = llmResult.text;

    await logAiCall(supabase, {
      tenant_id: payload?.tenantId ?? null,
      user_id: user?.id ?? null,
      function_name: "nexus-copilot",
      model_used: `${llmResult.provider}:${llmResult.model}`,
      output_summary: { snippet_count: matches.length },
      pii_detected: redacted.length > 0,
      pii_fields_redacted: redacted,
    });

    return new Response(JSON.stringify({ ok: true, answer, snippets: matches }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    logger.error("Nexus copilot error", { error: e });
    return new Response(JSON.stringify({ ok: false, error: e?.message || String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}, "nexus-copilot");
