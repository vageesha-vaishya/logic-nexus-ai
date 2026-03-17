declare const Deno: any;
import { z } from 'zod';
import { getCorsHeaders } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';
import { serveWithLogger } from '../_shared/logger.ts';

const RequestSchema = z.object({
  action: z.enum(['create_payment_session']),
  tenant_id: z.string().uuid(),
  subscription_id: z.string().uuid(),
  plan_id: z.string().uuid(),
  amount_due: z.number().nonnegative(),
  currency: z.string().min(3).max(5).default('USD'),
  billing_period: z.enum(['monthly', 'annual']).default('monthly'),
  payment_provider: z.enum(['mock', 'stripe', 'razorpay']).default('mock'),
  requested_user_count: z.number().int().nonnegative().optional(),
  requested_franchise_count: z.number().int().nonnegative().optional(),
});

serveWithLogger(async (req, logger, supabase) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { user, error: authError, supabaseClient } = await requireAuth(req, logger);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = parsed.data;

    const { data: authorizedTenant, error: authTenantError } = await supabaseClient
      .from('tenants')
      .select('id,name')
      .eq('id', payload.tenant_id)
      .maybeSingle();
    if (authTenantError || !authorizedTenant) {
      return new Response(JSON.stringify({ error: 'Tenant access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: subscription, error: subscriptionError } = await supabase
      .from('tenant_subscriptions')
      .select('id,tenant_id,metadata')
      .eq('id', payload.subscription_id)
      .eq('tenant_id', payload.tenant_id)
      .maybeSingle();
    if (subscriptionError || !subscription) {
      return new Response(JSON.stringify({ error: 'Subscription not found for tenant' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const appBaseUrl = Deno.env.get('APP_BASE_URL') || 'http://localhost:8080';
    const paymentSessionId = `${payload.payment_provider}_${globalThis.crypto.randomUUID()}`;
    const paymentUrl = `${appBaseUrl}/dashboard/subscription?payment_session_id=${encodeURIComponent(paymentSessionId)}`;
    const providerMetadata = {
      provider: payload.payment_provider,
      billing_period: payload.billing_period,
      amount_due: payload.amount_due,
      currency: payload.currency.toUpperCase(),
      requested_user_count: payload.requested_user_count ?? 0,
      requested_franchise_count: payload.requested_franchise_count ?? 0,
      created_at: new Date().toISOString(),
    };

    const mergedMetadata = {
      ...((subscription.metadata as any) || {}),
      payment_session_id: paymentSessionId,
      payment_url: paymentUrl,
      payment_status: 'pending',
      provider_metadata: providerMetadata,
    };

    const { error: updateSubError } = await supabase
      .from('tenant_subscriptions')
      .update({
        status: 'trial',
        metadata: mergedMetadata,
      })
      .eq('id', payload.subscription_id)
      .eq('tenant_id', payload.tenant_id);
    if (updateSubError) throw updateSubError;

    const { error: sessionError } = await supabase
      .from('tenant_onboarding_sessions')
      .upsert(
        {
          tenant_id: payload.tenant_id,
          status: 'payment_pending',
          current_step: 'payment',
          started_by: user.id,
          step_payloads: {
            phase2: {
              plan_selected: true,
              payment_required: true,
              payment_verified: false,
              payment_provider: payload.payment_provider,
              payment_session_id: paymentSessionId,
              payment_url: paymentUrl,
              amount_due: payload.amount_due,
              currency: payload.currency.toUpperCase(),
            },
          },
          failure_reason: null,
          completed_at: null,
        },
        { onConflict: 'tenant_id' }
      );
    if (sessionError) throw sessionError;

    return new Response(
      JSON.stringify({
        success: true,
        tenant_id: payload.tenant_id,
        subscription_id: payload.subscription_id,
        payment_session_id: paymentSessionId,
        payment_url: paymentUrl,
        provider_metadata: providerMetadata,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    await logger.error('tenant-onboarding-orchestrator failure', { error: error?.message || String(error) });
    return new Response(
      JSON.stringify({ error: error?.message || 'Failed to orchestrate onboarding payment session' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}, 'tenant-onboarding-orchestrator');
