import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { user, error: authError, supabaseClient } = await requireAuth(req);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized', details: authError }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Parse Body
    const { quoteId, type, reason } = await req.json();
    console.log(`[save-quotation-version] Payload:`, { quoteId, type, reason });

    if (!quoteId) {
      return new Response(JSON.stringify({ error: 'Missing quoteId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Fetch current quote data (Subject to RLS)
    const { data: quote, error: quoteError } = await supabaseClient
      .from('quotes')
      .select('*')
      .eq('id', quoteId)
      .single();

    if (quoteError || !quote) {
       console.error('[save-quotation-version] Quote fetch failed or not found:', quoteError);
       return new Response(JSON.stringify({ error: 'Quote not found or permission denied' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: items } = await supabaseClient.from('quote_items').select('*').eq('quote_id', quoteId);
    const { data: cargo } = await supabaseClient.from('quote_cargo_configurations').select('*').eq('quote_id', quoteId);
    
    const snapshot = {
        quote,
        items: items || [],
        cargo: cargo || []
    };

    // 6. Determine new version numbers
    const { data: latest } = await supabaseClient
      .from('quotation_versions')
      .select('major, minor, version_number')
      .eq('quote_id', quoteId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    let major = latest?.major || 1;
    let minor = latest?.minor || 0;
    let versionNum = latest?.version_number || 0;

    if (type === 'major') {
      major++;
      minor = 0;
    } else {
      minor++; 
    }
    versionNum++;

    // 7. Create version record (Subject to RLS - User must have INSERT permission)
    const { data: newVersion, error: versionError } = await supabaseClient
      .from('quotation_versions')
      .insert({
        quote_id: quoteId,
        tenant_id: quote.tenant_id,
        major: major,
        minor: minor,
        version_number: versionNum,
        kind: type === 'major' ? 'major' : 'minor',
        status: 'active',
        change_reason: reason,
        created_by: user.id, // Explicitly set created_by to current user
        metadata: {
            snapshot,
            source: 'manual_save'
        }
      })
      .select()
      .single();

    if (versionError) {
        console.error('[save-quotation-version] Version insert failed:', versionError);
        throw versionError;
    }

    // 8. Update parent quote current_version_id (Subject to RLS)
    const { error: updateError } = await supabaseClient
        .from('quotes')
        .update({ current_version_id: newVersion.id })
        .eq('id', quoteId);

    if (updateError) {
        console.warn('[save-quotation-version] Failed to update current_version_id on quote:', updateError);
        // We don't fail the request, as the version is saved.
    }

    return new Response(JSON.stringify(newVersion), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[save-quotation-version] Internal Server Error:', message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
