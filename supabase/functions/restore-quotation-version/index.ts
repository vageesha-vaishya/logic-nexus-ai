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

    const { versionId } = await req.json();
    console.log(`[restore-quotation-version] Payload:`, { versionId });

    if (!versionId) {
      return new Response(JSON.stringify({ error: 'Missing versionId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Fetch the version to restore (Subject to RLS)
    const { data: version, error: versionError } = await supabaseClient
      .from('quotation_versions')
      .select('*')
      .eq('id', versionId)
      .single();

    if (versionError || !version) {
       console.error('[restore-quotation-version] Version fetch failed or not found:', versionError);
       return new Response(JSON.stringify({ error: 'Version not found or permission denied' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Validate metadata snapshot exists
    const snapshot = (version.metadata as any)?.snapshot;
    if (!snapshot || !snapshot.quote) {
        return new Response(JSON.stringify({ error: 'Version has no valid snapshot data' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const { quote, items, cargo } = snapshot;

    // 6. Restore Quote Core Data (Subject to RLS)
    const { error: updateError } = await supabaseClient
        .from('quotes')
        .update({
            ...quote,
            updated_at: new Date().toISOString(), // Touch timestamp
            current_version_id: version.id // Set this restored version as current
        })
        .eq('id', quote.id);

    if (updateError) {
        console.error('[restore-quotation-version] Quote update failed:', updateError);
        throw updateError;
    }

    // 7. Restore Related Data (Items, Cargo)
    // 7.1 Delete existing items
    const { error: delItemsError } = await supabaseClient.from('quote_items').delete().eq('quote_id', quote.id);
    if (delItemsError) throw delItemsError;
    
    // 7.2 Insert snapshot items
    if (items && items.length > 0) {
        const { error: itemsError } = await supabaseClient.from('quote_items').insert(items);
        if (itemsError) throw itemsError;
    }

    // 7.3 Delete existing cargo
    const { error: delCargoError } = await supabaseClient.from('quote_cargo_configurations').delete().eq('quote_id', quote.id);
    if (delCargoError) throw delCargoError;

    // 7.4 Insert snapshot cargo
    if (cargo && cargo.length > 0) {
        const { error: cargoError } = await supabaseClient.from('quote_cargo_configurations').insert(cargo);
        if (cargoError) throw cargoError;
    }

    return new Response(JSON.stringify({ success: true, restoredVersionId: version.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[restore-quotation-version] Internal Server Error:', message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
