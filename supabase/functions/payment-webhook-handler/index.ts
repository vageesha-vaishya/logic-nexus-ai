declare const Deno: any;
import { z } from 'zod';
import { getCorsHeaders } from '../_shared/cors.ts';
import { isServiceRoleAuthorizationHeader, requireAuth } from '../_shared/auth.ts';
import { serveWithLogger } from '../_shared/logger.ts';

const PaymentWebhookSchema = z.object({
  provider: z.enum(['stripe', 'razorpay', 'mock']),
  event_id: z.string().min(1),
  event_type: z.enum(['payment_succeeded', 'payment_failed']),
  tenant_id: z.string().uuid().optional(),
  subscription_id: z.string().uuid().optional(),
  payment_session_id: z.string().optional(),
  amount_paid: z.number().nonnegative().optional(),
  currency: z.string().min(3).max(5).optional(),
  failure_reason: z.string().optional(),
  payload: z.record(z.string(), z.any()).optional(),
});

const mergeStepPayloads = (existing: any, next: any) => ({
  ...(existing || {}),
  ...(next || {}),
  phase1: {
    ...((existing || {}).phase1 || {}),
    ...((next || {}).phase1 || {}),
  },
  phase2: {
    ...((existing || {}).phase2 || {}),
    ...((next || {}).phase2 || {}),
  },
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

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authHeader = req.headers.get('Authorization');
  const isServiceRequest = isServiceRoleAuthorizationHeader(authHeader, serviceRoleKey);
  let actorUserId: string | null = null;

  if (!isServiceRequest) {
    const { user, error } = await requireAuth(req, logger);
    if (error || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    actorUserId = user.id;
  }

  try {
    const body = await req.json();
    const parsed = PaymentWebhookSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const event = parsed.data;

    const { error: eventInsertError } = await supabase
      .from('payment_webhook_events')
      .insert({
        provider: event.provider,
        event_id: event.event_id,
        event_type: event.event_type,
        payload: event.payload || {},
        status: 'processed',
        error_message: event.event_type === 'payment_failed' ? event.failure_reason || null : null,
        processed_at: new Date().toISOString(),
      });

    if (eventInsertError && !String(eventInsertError.message || '').includes('uq_payment_webhook_events_provider_event')) {
      throw eventInsertError;
    }

    if (eventInsertError && String(eventInsertError.message || '').includes('uq_payment_webhook_events_provider_event')) {
      return new Response(JSON.stringify({ success: true, duplicate: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!event.subscription_id) {
      return new Response(JSON.stringify({ success: true, message: 'Webhook recorded without subscription updates' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: subscription, error: subscriptionError } = await supabase
      .from('tenant_subscriptions')
      .select('id, tenant_id, metadata')
      .eq('id', event.subscription_id)
      .maybeSingle();
    if (subscriptionError || !subscription) {
      return new Response(JSON.stringify({ success: true, message: 'Webhook recorded but subscription not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tenantId = event.tenant_id || subscription.tenant_id;
    const nextMetadata = {
      ...((subscription.metadata as any) || {}),
      payment_status: event.event_type === 'payment_succeeded' ? 'paid' : 'failed',
      payment_provider: event.provider,
      payment_session_id: event.payment_session_id || (subscription.metadata as any)?.payment_session_id || null,
      payment_event_id: event.event_id,
      payment_event_type: event.event_type,
      payment_failure_reason: event.event_type === 'payment_failed' ? event.failure_reason || null : null,
      paid_at: event.event_type === 'payment_succeeded' ? new Date().toISOString() : null,
    };

    const nextStatus = event.event_type === 'payment_succeeded' ? 'active' : 'past_due';

    const { error: subscriptionUpdateError } = await supabase
      .from('tenant_subscriptions')
      .update({
        status: nextStatus,
        metadata: nextMetadata,
      })
      .eq('id', event.subscription_id);
    if (subscriptionUpdateError) throw subscriptionUpdateError;

    const { data: latestInvoice } = await supabase
      .from('subscription_invoices')
      .select('id')
      .eq('subscription_id', event.subscription_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestInvoice?.id) {
      await supabase
        .from('subscription_invoices')
        .update({
          status: event.event_type === 'payment_succeeded' ? 'paid' : 'open',
          amount_paid: event.event_type === 'payment_succeeded' ? event.amount_paid ?? null : 0,
          paid_at: event.event_type === 'payment_succeeded' ? new Date().toISOString() : null,
          currency: (event.currency || 'USD').toUpperCase(),
          metadata: {
            provider: event.provider,
            event_id: event.event_id,
            event_type: event.event_type,
          },
        })
        .eq('id', latestInvoice.id);
    }

    const { data: existingSession } = await supabase
      .from('tenant_onboarding_sessions')
      .select('step_payloads')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const mergedPayloads = mergeStepPayloads(existingSession?.step_payloads || {}, {
      phase2: {
        payment_required: true,
        payment_verified: event.event_type === 'payment_succeeded',
        payment_provider: event.provider,
        payment_event_id: event.event_id,
      },
    });

    await supabase
      .from('tenant_onboarding_sessions')
      .upsert(
        {
          tenant_id: tenantId,
          status: event.event_type === 'payment_succeeded' ? 'provisioning' : 'support_assisted',
          current_step: event.event_type === 'payment_succeeded' ? 'domain_provisioning' : 'payment',
          started_by: actorUserId,
          step_payloads: mergedPayloads,
          failure_reason: event.event_type === 'payment_failed' ? event.failure_reason || 'Payment failure received from gateway' : null,
          completed_at: null,
        },
        { onConflict: 'tenant_id' }
      );

    return new Response(
      JSON.stringify({
        success: true,
        subscription_id: event.subscription_id,
        tenant_id: tenantId,
        next_status: nextStatus,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    await logger.error('payment-webhook-handler failure', { error: error?.message || String(error) });
    return new Response(
      JSON.stringify({ error: error?.message || 'Failed to process payment webhook' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}, 'payment-webhook-handler');
