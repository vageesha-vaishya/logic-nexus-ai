import { getCorsHeaders } from "../_shared/cors.ts"
import { requireAuth } from "../_shared/auth.ts"
import { serveWithLogger } from "../_shared/logger.ts"
import { callLLM, LlmCallContext } from "../_shared/llm-gateway.ts"

serveWithLogger(async (req, logger, supabase) => {
  const headers = getCorsHeaders(req);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  try {
    // Require authentication
    const { user, error: authError } = await requireAuth(req);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...headers, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Resolve tenant for this caller (needed by the LLM gateway to pick a
    // per-tenant provider config, or fall through to the self-hosted rig).
    const { data: roleRows, error: roleError } = await supabase
      .from('user_roles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .not('tenant_id', 'is', null)
      .limit(1);
    const tenantId: string | null = roleRows?.[0]?.tenant_id ?? null;
    if (roleError || !tenantId) {
      logger.warn("Caller has no tenant assignment", { userId: user.id, error: roleError?.message });
      return new Response(
        JSON.stringify({ error: 'No tenant assignment for this user' }),
        { headers: { ...headers, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const { file_url, file_type } = await req.json()

    // Validate Input
    if (!file_url || typeof file_url !== 'string') {
      throw new Error('Missing or invalid file_url');
    }

    // Initialize Supabase with service role for HTS lookups
    // Already initialized by serveWithLogger as 'supabase'

    logger.info(`Processing Invoice: ${file_url}`);

    // Extract line items via the shared LLM Gateway (routes to
    // tenant-configured provider, or falls through to the self-hosted vLLM
    // rig — see _shared/llm-gateway.ts).
    //
    // NOTE: the previous direct OpenAI call sent the invoice as a vision
    // (image_url) content block. The gateway's callLLM only accepts plain
    // text system/user prompts — there is no multimodal passthrough — so the
    // file_url is forwarded as a text reference rather than image bytes.
    // Providers that cannot themselves fetch/view the URL will not actually
    // read the invoice image. See migration report for detail.
    const ctx: LlmCallContext = { tenantId, userId: user.id, supabaseAdmin: supabase, logger };
    const llmResult = await callLLM("logistics.invoice_extract", {
      file_url: String(file_url),
      file_type: String(file_type || 'unknown'),
    }, ctx);

    let extractedData: any;
    try {
        // Clean potential markdown code blocks if the model ignored instructions
        const cleanContent = llmResult.text.replace(/```json/g, '').replace(/```/g, '').trim();
        extractedData = JSON.parse(cleanContent);
    } catch (e) {
        logger.error("JSON Parse Error", { content: llmResult.text });
        throw new Error("Failed to parse AI response as JSON");
    }

    // 3. Enrich with Master Data (Smart Mapping)
    const enrichedItems = await Promise.all(extractedData.items.map(async (item: any) => {
        // Search for HTS/Commodity Match
        const searchTerm = item.hs_code || item.description;

        let match = null;

        // Try exact match if HS code exists
        if (item.hs_code) {
             const { data } = await supabase.rpc('search_hts_codes_smart', {
                p_search_term: item.hs_code,
                p_limit: 1
            });
            if (data && data.length > 0) match = data[0];
        }

        // Fallback to description search
        if (!match && item.description) {
            const { data } = await supabase.rpc('search_hts_codes_smart', {
                p_search_term: item.description,
                p_limit: 1
            });
            if (data && data.length > 0) match = data[0];
        }

        return {
            ...item,
            suggested_aes_hts_id: match ? match.id : null,
            suggested_hts_code: match ? match.hts_code : null,
            suggested_category: match ? match.category : null,
            confidence: match ? match.rank : 0
        };
    }));

    return new Response(
      JSON.stringify({
          success: true,
          original_items: extractedData.items,
          enriched_items: enrichedItems
      }),
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    logger.error("Error processing invoice", { error });
    return new Response(
      JSON.stringify({ error: error.message || 'An unknown error occurred' }),
      { headers: { ...headers, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
}, "extract-invoice-items")
