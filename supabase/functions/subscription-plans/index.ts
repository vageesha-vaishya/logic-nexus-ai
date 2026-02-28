declare const Deno: any;
import { serveWithLogger } from '../_shared/logger.ts';
import { requireAuth } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

interface PlanPayload {
  name: string;
  slug: string;
  description?: string | null;
  plan_type?: string;
  tier?: string | null;
  billing_period?: string;
  price_monthly?: number;
  price_quarterly?: number | null;
  price_annual?: number | null;
  currency?: string;
  features?: Record<string, unknown>;
  limits?: Record<string, unknown>;
  trial_period_days?: number | null;
  deployment_model?: string | null;
  supported_currencies?: string[];
  supported_languages?: string[];
  metadata?: Record<string, unknown>;
  is_active?: boolean;
  user_scaling_factor?: number;
  min_users?: number;
  max_users?: number | null;
}

serveWithLogger(async (req, logger, supabase) => {
  const headers = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const { method } = req;

    const { user, error: authError } = await requireAuth(req);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } },
      );
    }

    const { data: isAdmin } = await supabase.rpc('is_platform_admin', { check_user_id: user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    if (method === 'GET') {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) {
        logger.error('List plans failed', { error: error.message });
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    if (method === 'POST') {
      const body = (await req.json()) as PlanPayload;
      const { data, error } = await supabase
        .from('subscription_plans')
        .insert(body)
        .select('id')
        .single();
      if (error) {
        logger.error('Create plan failed', { error: error.message });
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }
      const createdId = (data as any)?.id;
      if (createdId) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'create',
          resource_type: 'subscription_plan',
          resource_id: createdId,
          details: body,
        });
      }
      return new Response(JSON.stringify({ data }), {
        status: 201,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    if (method === 'PUT' || method === 'PATCH') {
      if (!id) {
        return new Response(JSON.stringify({ error: 'Missing id' }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }
      const body = (await req.json()) as PlanPayload;
      const { error } = await supabase
        .from('subscription_plans')
        .update(body)
        .eq('id', id);
      if (error) {
        logger.error('Update plan failed', { error: error.message });
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'update',
        resource_type: 'subscription_plan',
        resource_id: id,
        details: body,
      });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    if (method === 'DELETE') {
      if (!id) {
        return new Response(JSON.stringify({ error: 'Missing id' }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }
      const { error } = await supabase
        .from('subscription_plans')
        .delete()
        .eq('id', id);
      if (error) {
        logger.error('Delete plan failed', { error: error.message });
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'delete',
        resource_type: 'subscription_plan',
        resource_id: id,
        details: {},
      });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    logger.error('Unexpected error', { error: err?.message });
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
}, "subscription-plans");
