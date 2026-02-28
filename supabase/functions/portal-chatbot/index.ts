import { serveWithLogger } from "../_shared/logger.ts";
import { requireAuth } from "../_shared/auth.ts";
import { logAiCall } from "../_shared/audit.ts";
import { sanitizeForLLM } from "../_shared/pii-guard.ts";

declare const Deno: any;

type PortalChatRequest = {
  query: string;
  token?: string;
  topK?: number;
};

serveWithLogger(async (req, logger, supabaseAdmin) => {
  try {
    // Public portal can be unauthenticated; use token scoping for data access
    let user = null;
    try {
        const auth = await requireAuth(req);
        user = auth.user;
    } catch {
        // ignore auth errors for public portal
    }

    let payload: PortalChatRequest | null = null;
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const q = (payload?.query || "").trim();
    if (!q) {
      return new Response(JSON.stringify({ error: "Missing query" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = supabaseAdmin;

    // Scope: if token provided, load quote context
    let quoteContext = "";
    if (payload?.token) {
      try {
        const { data } = await supabase.rpc("get_quote_by_token", { p_token: payload.token });
        if (data?.quote) {
          const q = data.quote;
          quoteContext = `Quote #${q.quote_number || ""} for ${q.accounts?.name || ""}, total ${q.currency_code || "USD"} ${q.sell_price || ""}, status ${q.status || "draft"}.`;
        }
      } catch (err) {
        logger.warn("Failed to get quote by token", { error: err });
      }
    }

    // Embedding + KB search
    const openaiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    let embedding: number[] = [];
    if (openaiKey) {
      try {
        const embRes = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
          body: JSON.stringify({ model: "text-embedding-3-small", input: q }),
        });
        if (embRes.ok) {
          const embJson = await embRes.json();
          embedding = embJson.data?.[0]?.embedding || [];
        } else {
           logger.error(`OpenAI Embedding failed: ${embRes.status}`);
        }
      } catch (err) {
        logger.error("OpenAI Embedding error", { error: err });
      }
    }

    const topK = Math.min(Math.max(payload?.topK ?? 5, 1), 20);
    const { data: matches, error: matchError } = await supabase.rpc("match_documents_scoped", {
      query_embedding: embedding,
      similarity_threshold: 0.2,
      match_count: topK,
      tenant_id: null,
    });
    
    if (matchError) {
        logger.error("Match documents error", { error: matchError });
    }

    const context = (matches || []).map((m: any) => `Title: ${m.title}\nContent:\n${m.content}`).join("\n\n---\n\n");

    const { sanitized, redacted } = sanitizeForLLM(`${quoteContext}\n\n${context}`);
    const sys = "You are a customer-facing assistant in a logistics quote portal. Answer strictly based on provided context. If unsure, say you don't know. Do not reveal internal details.";
    const userMsg = `Question:\n<user_context>${q}</user_context>\nQuote:\n${quoteContext}\nDocs:\n${sanitized}\nReply with JSON:\n{"answer":"...", "actions":[{"type":"accept_quote","params":{}},{"type":"predict_eta","params":{"origin_id":"","destination_id":"","mode":""}}]}`;
    let answer = "I'm not sure. Please contact support.";
    let actions: any[] = [];
    if (openaiKey) {
      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
          body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "system", content: sys }, { role: "user", content: userMsg }], temperature: 0.2, max_tokens: 400 }),
        });
        if (res.ok) {
          const json = await res.json();
          try {
            const parsed = JSON.parse(json.choices[0].message.content);
            answer = parsed.answer || answer;
            actions = Array.isArray(parsed.actions) ? parsed.actions : [];
          } catch { /* ignore */ }
        } else {
            logger.error(`OpenAI Chat failed: ${res.status}`);
        }
      } catch (err) {
        logger.error("OpenAI Chat error", { error: err });
      }
    }

    await logAiCall(supabase, {
      user_id: user?.id ?? null,
      function_name: "portal-chatbot",
      model_used: "gpt-4o-mini",
      output_summary: { answer_preview: answer.slice(0, 80), action_count: actions.length },
      pii_detected: redacted.length > 0,
      pii_fields_redacted: redacted,
    });

    return new Response(JSON.stringify({ ok: true, answer, actions }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    logger.error("Portal chatbot error", { error: e });
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}, "portal-chatbot");
