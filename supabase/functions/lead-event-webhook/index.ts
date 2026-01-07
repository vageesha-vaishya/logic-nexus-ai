import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.22.4';
import { corsHeaders } from '../_shared/cors.ts';

const LeadEventSchema = z.object({
  lead_id: z.string().uuid(),
  type: z.enum(['email_opened', 'link_clicked', 'page_view', 'form_submission']),
  metadata: z.record(z.string(), z.any()).optional(),
  timestamp: z.string().datetime().optional()
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    
    // Validate payload
    const result = LeadEventSchema.safeParse(body);
    if (!result.success) {
        return new Response(
            JSON.stringify({ error: result.error }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }

    const { lead_id, type, metadata, timestamp } = result.data;

    // Insert activity
    const { error: insertError } = await supabase
        .from('lead_activities')
        .insert({
            lead_id,
            type,
            metadata: metadata || {},
            created_at: timestamp || new Date().toISOString()
        });

    if (insertError) throw insertError;

    // Trigger score calculation
    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\./)?.[1];
        const functionsUrl = projectRef 
            ? `https://${projectRef}.supabase.co/functions/v1` 
            : 'http://localhost:54321/functions/v1'; // Fallback for local

        await fetch(`${functionsUrl}/calculate-lead-score`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ lead_id })
        });
    } catch (err) {
        console.error('Failed to trigger score calculation:', err);
        // Don't fail the request, just log it
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Event recorded and score update triggered' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
