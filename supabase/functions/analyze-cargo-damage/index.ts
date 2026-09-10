import { serveWithLogger } from "../_shared/logger.ts"
import { getCorsHeaders } from "../_shared/cors.ts"
import { requireAuth } from "../_shared/auth.ts"
import { callLLM, LlmCallContext } from "../_shared/llm-gateway.ts"

serveWithLogger(async (req, logger, supabaseAdmin) => {
  logger.info("Cargo Damage Analyzer v1.0 Initialized")

  const headers = getCorsHeaders(req);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  try {
    const { user, error: authError } = await requireAuth(req, logger);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    const { data: roleRows } = await supabaseAdmin
      .from('user_roles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .not('tenant_id', 'is', null)
      .limit(1);
    const tenantId: string | null = roleRows?.[0]?.tenant_id ?? null;

    const { file_url } = await req.json()

    // Validate Input
    if (!file_url) {
      throw new Error('Missing file_url');
    }

    logger.info(`Analyzing Cargo Image: ${file_url}`);

    // Routes through the shared LLM gateway (tenant-configured provider,
    // self-hosted by default; falls back to Gemini only if that fails --
    // see _shared/llm-gateway.ts's PAID_FALLBACK_ON_FAILURE).
    const ctx: LlmCallContext = { tenantId, userId: user.id, supabaseAdmin, logger };
    const llmResult = await callLLM("logistics.cargo_damage_analysis", {}, ctx, { image: { url: file_url } });

    let analysisResult;
    try {
        const cleanContent = llmResult.text.replace(/```json/gi, '').replace(/```/g, '').trim();
        analysisResult = JSON.parse(cleanContent);
    } catch (e) {
        logger.error("JSON Parse Error", { content: llmResult.text });
        throw new Error("Failed to parse AI response as JSON");
    }

    return new Response(
      JSON.stringify({
          success: true,
          analysis: analysisResult,
          timestamp: new Date().toISOString()
      }),
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    logger.error('Error analyzing cargo damage', { error })
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...headers, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
}, "analyze-cargo-damage")
