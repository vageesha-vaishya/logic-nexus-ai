import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { sanitizeForLLM } from "../_shared/pii-guard.ts";
import { pickEmbeddingModel } from "../_shared/model-router.ts";
import { logAiCall } from "../_shared/audit.ts";

declare const Deno: any;

type CopilotRequest = {
  query: string;
  tenantId?: string | null;
  topK?: number;
  threshold?: number;
};

Deno.serve(async (req: Request) => {
  const headers = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  try {
    const { user, error: authError } = await requireAuth(req);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    let payload: CopilotRequest | null;
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const query = payload?.query?.trim();
    if (!query) {
      return new Response(JSON.stringify({ error: "Missing query" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const { sanitized, redacted } = sanitizeForLLM(query);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { provider, model, url, headers: embHeaders } = pickEmbeddingModel();
    const embRes = await fetch(url, {
      method: "POST",
      headers: embHeaders,
      body: JSON.stringify({ input: sanitized, model }),
    });
    if (!embRes.ok) {
      const text = await embRes.text();
      throw new Error(`Embedding error: ${text}`);
    }
    const embJson = await embRes.json();
    const embedding = embJson?.data?.[0]?.embedding;
    if (!Array.isArray(embedding)) throw new Error("No embedding returned");

    const topK = Math.min(Math.max(payload?.topK ?? 8, 1), 50);
    const threshold = payload?.threshold ?? 0.2;

    const { data: matches, error: matchErr } = await supabase.rpc("match_documents_scoped", {
      query_embedding: embedding,
      similarity_threshold: threshold,
      match_count: topK,
      tenant_id: payload?.tenantId ?? null,
    });
    if (matchErr) throw matchErr;

    const context = (matches || [])
      .map((m: any, i: number) => `# Doc ${i + 1}\nTitle: ${m.title}\nContent:\n${m.content}`)
      .join("\n\n");

    const openaiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    const chatRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are Nexus Copilot for a logistics CRM. Answer strictly based on provided context. If context is insufficient, say you don't know and suggest collecting more data.",
          },
          {
            role: "user",
            content: `Question:\n${sanitized}\n\nContext:\n${context}\n\nRespond concisely with clear steps or references.`,
          },
        ],
        temperature: 0.2,
      }),
    });
    if (!chatRes.ok) {
      const t = await chatRes.text();
      throw new Error(`Chat error: ${t}`);
    }
    const chatJson = await chatRes.json();
    const answer = chatJson?.choices?.[0]?.message?.content ?? "";

    await logAiCall(supabase, {
      tenant_id: payload?.tenantId ?? null,
      user_id: user?.id ?? null,
      function_name: "nexus-copilot",
      model_used: "gpt-4o-mini",
      output_summary: { snippet_count: (matches || []).length },
      pii_detected: redacted.length > 0,
      pii_fields_redacted: redacted,
    });

    return new Response(JSON.stringify({ ok: true, answer, snippets: matches || [] }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || String(e) }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
