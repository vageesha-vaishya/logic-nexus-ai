import { serveWithLogger } from '../_shared/logger.ts';
import { requireAuth } from '../_shared/auth.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { callLLM, LlmCallContext } from '../_shared/llm-gateway.ts';

serveWithLogger(async (req, logger, supabaseAdmin) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { user, error: authError } = await requireAuth(req);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Resolve tenant for this caller (needed by the LLM gateway to pick a
    // per-tenant provider config, or fall through to the self-hosted rig).
    const { data: roleRows, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .not('tenant_id', 'is', null)
      .limit(1);
    const tenantId: string | null = roleRows?.[0]?.tenant_id ?? null;
    if (roleError || !tenantId) {
      logger.warn('Caller has no tenant assignment', { userId: user.id, error: roleError?.message });
      return new Response(JSON.stringify({ error: 'No tenant assignment for this user' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { prompt, responseFormat } = await req.json();

    // Force English output
    const promptWithLang = prompt + "\n\n(IMPORTANT: Respond in English only, regardless of the input language.)";
    // NOTE: the caller could previously request JSON output via OpenAI's
    // response_format:{type:"json_object"} or Gemini's responseMimeType.
    // The gateway has no such per-call knob, so the same intent is now
    // carried as an extra instruction baked into the user prompt.
    const formatInstruction = responseFormat === 'json'
      ? 'Respond with a single valid JSON object only — no markdown code fences, no commentary.'
      : '';

    let text = "";
    let usedService = "none";
    let usedModel = "none";
    const startTime = Date.now();

    // STRATEGY 1: Route through the shared LLM Gateway (tenant-configured
    // provider, or the self-hosted vLLM rig fallback — see
    // _shared/llm-gateway.ts). NOTE: the caller-selectable provider/model
    // choice (formerly Gemini-vs-OpenAI depending on which API key was
    // present, plus an optional `model` override) is no longer honored —
    // the gateway's own routing (tenant config, then env fallback) now picks
    // the provider for every caller.
    try {
      const ctx: LlmCallContext = { tenantId, userId: user.id, supabaseAdmin, logger };
      const llmResult = await callLLM("logistics.transport_mode_suggest", {
        prompt: promptWithLang,
        format_instruction: formatInstruction,
      }, ctx);
      text = llmResult.text.trim();
      usedService = "Gateway";
      usedModel = `${llmResult.provider}:${llmResult.model}`;
    } catch (e: any) {
      logger.warn("LLM gateway call failed", { error: e?.message ?? String(e) });
    }

    // STRATEGY 2: Heuristic Fallback (Offline Mode)
    // If the gateway call fails, use simple keyword matching to ensure the feature works.
    if (!text) {
        usedService = "Heuristic (Fallback)";
        usedModel = "keyword-match";
        logger.info("Using heuristic fallback logic.");
        const lowerPrompt = (prompt || "").toLowerCase();
        let suggestion = "Road Freight"; // Default

        if (lowerPrompt.includes("air") || lowerPrompt.includes("flight") || lowerPrompt.includes("urgent") || lowerPrompt.includes("plane")) {
            suggestion = "Air Freight";
        } else if (lowerPrompt.includes("sea") || lowerPrompt.includes("ocean") || lowerPrompt.includes("container") || lowerPrompt.includes("vessel") || lowerPrompt.includes("port")) {
            suggestion = "Sea Freight";
        } else if (lowerPrompt.includes("rail") || lowerPrompt.includes("train")) {
            suggestion = "Rail Freight";
        }

        // Mimic the expected LLM output format so the UI parses it correctly
        text = `Analysis (Offline Mode): Recommended Transport: [${suggestion}]`;
    }

    const duration_ms = Date.now() - startTime;

    return new Response(JSON.stringify({
      text,
      meta: {
        service: usedService,
        model: usedModel,
        prompt: prompt, // Echo back for logging
        duration_ms: duration_ms,
        timestamp: new Date().toISOString()
      }
    }), {
      headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Content-Language': 'en'
      },
    });
  } catch (error: any) {
    logger.error("Suggest transport mode error", { error });
    return new Response(JSON.stringify({ error: (error as any).message || String(error) }), {
      status: 200, // Return 200 so client parses error message
      headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Content-Language': 'en'
      },
    });
  }
}, "suggest-transport-mode");
