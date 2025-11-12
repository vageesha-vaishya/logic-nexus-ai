declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};
// @ts-expect-error Supabase Edge (Deno) resolves URL imports at runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Stage =
  | 'prospecting'
  | 'qualification'
  | 'needs_analysis'
  | 'value_proposition'
  | 'proposal'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost';

const stageToSalesforce: Record<Stage, string> = {
  prospecting: 'Prospecting',
  qualification: 'Qualification',
  needs_analysis: 'Needs Analysis',
  value_proposition: 'Value Proposition',
  proposal: 'Proposal/Price Quote',
  negotiation: 'Negotiation/Review',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const SALESFORCE_INSTANCE_URL = (Deno.env.get('SALESFORCE_INSTANCE_URL') || '').replace(/\/$/, '');
    const SALESFORCE_ACCESS_TOKEN = Deno.env.get('SALESFORCE_ACCESS_TOKEN') || '';
    const SALESFORCE_API_VERSION = Deno.env.get('SALESFORCE_API_VERSION') || 'v60.0';

    if (!SALESFORCE_INSTANCE_URL || !SALESFORCE_ACCESS_TOKEN) {
      return new Response(
        JSON.stringify({ error: 'Salesforce environment is not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const { opportunity_id } = await req.json();
    if (!opportunity_id) {
      return new Response(
        JSON.stringify({ error: 'Missing opportunity_id' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { data: opp, error: oppErr } = await supabase
      .from('opportunities')
      .select('*')
      .eq('id', opportunity_id)
      .single();

    if (oppErr || !opp) {
      return new Response(
        JSON.stringify({ error: oppErr?.message || 'Opportunity not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    if (!opp.salesforce_opportunity_id) {
      return new Response(
        JSON.stringify({ error: 'Link a Salesforce Opportunity ID before syncing' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Prepare payload mapping to Salesforce standard fields
    const payload: Record<string, unknown> = {
      Name: opp.name,
      StageName: stageToSalesforce[(opp.stage || 'prospecting') as Stage] || 'Prospecting',
      Amount: opp.amount != null ? Number(opp.amount) : undefined,
      Probability: opp.probability != null ? Number(opp.probability) : undefined,
      CloseDate: opp.close_date || undefined,
      Description: opp.description || undefined,
      Type: opp.type || undefined,
      ForecastCategory: opp.forecast_category || undefined,
      LeadSource: opp.lead_source || undefined,
      NextStep: opp.next_step || undefined,
    };

    // Remove undefined values to avoid SF API errors
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

    const sfUrl = `${SALESFORCE_INSTANCE_URL}/services/data/${SALESFORCE_API_VERSION}/sobjects/Opportunity/${opp.salesforce_opportunity_id}`;

    const resp = await fetch(sfUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${SALESFORCE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const text = await resp.text();
      await supabase
        .from('opportunities')
        .update({
          salesforce_sync_status: 'error',
          salesforce_last_synced: new Date().toISOString(),
          salesforce_error: text?.slice(0, 2000) || 'Unknown Salesforce error',
        })
        .eq('id', opportunity_id);

      return new Response(
        JSON.stringify({ error: 'Salesforce sync failed', details: text }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
      );
    }

    await supabase
      .from('opportunities')
      .update({ salesforce_sync_status: 'success', salesforce_last_synced: new Date().toISOString(), salesforce_error: null })
      .eq('id', opportunity_id);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({ error: (error instanceof Error) ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});