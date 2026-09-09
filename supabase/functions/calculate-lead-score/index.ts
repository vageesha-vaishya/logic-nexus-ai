import { serveWithLogger } from '../_shared/logger.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { requireAuth, isServiceRoleAuthorizationHeader } from '../_shared/auth.ts';

serveWithLogger(async (req, logger, supabaseAdmin) => {
  const headers = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  try {
    // Two intended callers: lead-event-webhook triggers this internally
    // with SUPABASE_SERVICE_ROLE_KEY (its only current caller -- no
    // frontend reaches this function directly), or a regular authenticated
    // end user via this function's own requireAuth check. Both paths use
    // supabaseAdmin (service-role, bypasses RLS -- deliberate, per the
    // comment this replaces), so a non-service-role caller must be scoped
    // explicitly: lead_id came straight from the request body with no
    // check the caller's tenant owns that lead.
    const authHeader = req.headers.get('Authorization');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const isServiceRole = isServiceRoleAuthorizationHeader(authHeader, serviceRoleKey);

    // null = unrestricted (service-role caller, or an authenticated platform_admin)
    let allowedTenantIds: Set<string> | null = null;

    if (!isServiceRole) {
      const { user, error: authError } = await requireAuth(req);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } });
      }

      const { data: requesterRoles, error: rolesError } = await supabaseAdmin
        .from('user_roles')
        .select('role, tenant_id')
        .eq('user_id', user.id);
      if (rolesError) {
        logger.error('Failed to resolve requester roles', { error: rolesError, userId: user.id });
        return new Response(JSON.stringify({ error: 'Forbidden: cannot resolve requester role scope' }), { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } });
      }

      const roles = requesterRoles || [];
      const isPlatformAdmin = roles.some((r: any) => r.role === 'platform_admin');
      if (!isPlatformAdmin) {
        allowedTenantIds = new Set(
          roles.map((r: any) => r.tenant_id).filter((id: string | null) => !!id),
        );
      }
    }

    const supabase = supabaseAdmin;

    const { lead_id } = await req.json();

    if (!lead_id) {
      throw new Error('lead_id is required');
    }

    // 1. Fetch Lead Data
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', lead_id)
      .single();

    if (leadError) throw leadError;

    if (allowedTenantIds && !allowedTenantIds.has(lead.tenant_id)) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: lead outside caller scope' }),
        { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } },
      );
    }

    // 2. Fetch Score Config
    let config;
    if (lead.tenant_id) {
        const { data: tenantConfig } = await supabase
            .from('lead_score_config')
            .select('weights_json')
            .eq('tenant_id', lead.tenant_id)
            .single();
        config = tenantConfig?.weights_json;
    }

    // Fallback to default weights if no config found
    if (!config) {
        config = {
            demographic: {
                title_cxo: 20,
                title_vp: 15,
                title_manager: 10
            },
            behavioral: {
                email_opened: 5,
                link_clicked: 10,
                page_view: 2,
                form_submission: 20
            },
            logistics: {
                high_value_cargo: 20,
                urgent_shipment: 15
            },
            decay: {
                weekly_percentage: 10
            }
        };
    }

    // 3. Fetch Activities
    const { data: activities, error: activitiesError } = await supabase
      .from('lead_activities')
      .select('*')
      .eq('lead_id', lead_id);

    if (activitiesError) throw activitiesError;

    // 4. Calculate Score
    let score = 0;

    // Demographic Scoring
    const title = lead.title?.toLowerCase() || '';
    if (title.includes('ceo') || title.includes('cto') || title.includes('cfo') || title.includes('founder')) {
        score += config.demographic.title_cxo || 0;
    } else if (title.includes('vp') || title.includes('vice president')) {
        score += config.demographic.title_vp || 0;
    } else if (title.includes('manager') || title.includes('head')) {
        score += config.demographic.title_manager || 0;
    }

    // Behavioral Scoring
    activities?.forEach((activity: any) => {
        const points = config.behavioral[activity.type] || 0;
        score += points;
    });

    // Logistics Scoring
    if (lead.estimated_value && lead.estimated_value > 50000) {
        score += config.logistics.high_value_cargo || 0;
    }
    
    // Decay Logic
    if (lead.last_activity_date) {
        const lastActivity = new Date(lead.last_activity_date);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - lastActivity.getTime());
        const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
        
        if (diffWeeks > 0) {
            const decayRate = config.decay.weekly_percentage || 10;
            const decayFactor = Math.pow(1 - (decayRate / 100), diffWeeks);
            score = Math.round(score * decayFactor);
        }
    }

    // Ensure score is not negative (optional, but good practice)
    score = Math.max(0, score);

    // 5. Update Lead
    const { error: updateError } = await supabase
        .from('leads')
        .update({ 
            lead_score: score,
        })
        .eq('id', lead_id);

    if (updateError) throw updateError;

    // 6. Log Change
    // Only log if score changed to avoid spamming logs
    if (lead.lead_score !== score) {
        await supabase.from('lead_score_logs').insert({
            lead_id,
            old_score: lead.lead_score,
            new_score: score,
            change_reason: 'Automatic calculation via Edge Function'
        });
    }

    return new Response(
      JSON.stringify({ success: true, score }),
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Error in calculate-lead-score", { error: message });
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...headers, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
}, "calculate-lead-score");;
