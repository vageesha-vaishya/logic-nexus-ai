// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../types.d.ts" />
/**
 * billing-razorpay — Razorpay payment + invoice edge function
 *
 * POST /billing-razorpay   body: { action, ...params }
 *
 * Actions:
 *   create_order       → create Razorpay order for plan purchase
 *   verify_payment     → verify signature + activate subscription + emit invoice
 *   list_invoices      → paginated invoice history for current tenant
 *   get_invoice        → single invoice by id
 *   update_gstin       → save tenant GSTIN + billing address
 */

declare const Deno: any;

import { serveWithLogger }  from '../_shared/logger.ts';
import { requireAuth }      from '../_shared/auth.ts';
import { getCorsHeaders }   from '../_shared/cors.ts';
import { createClient }     from 'https://esm.sh/@supabase/supabase-js@2';

const RAZORPAY_KEY_ID     = Deno.env.get('RAZORPAY_KEY_ID')     ?? '';
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET') ?? '';
const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')        ?? '';
const SUPABASE_SERVICE_KEY= Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Our seller GSTIN (can be overridden via env)
const SELLER_GSTIN = Deno.env.get('SELLER_GSTIN') ?? '';
const SELLER_NAME  = Deno.env.get('SELLER_NAME')  ?? 'Logic Nexus AI Pvt. Ltd.';
const SELLER_ADDR  = Deno.env.get('SELLER_ADDRESS') ?? 'India';

function razorpayAuth(): string {
  return 'Basic ' + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
}

async function razorpayPost(path: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: 'POST',
    headers: {
      'Authorization': razorpayAuth(),
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.description ?? `Razorpay error ${res.status}`);
  return data;
}

async function verifySignature(
  orderId: string, paymentId: string, signature: string
): Promise<boolean> {
  const payload = `${orderId}|${paymentId}`;
  const key     = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(RAZORPAY_KEY_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const computed  = Array.from(new Uint8Array(sigBuffer))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  return computed === signature;
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleCreateOrder(body: any, tenantId: string, supabase: any) {
  const { plan_id, billing_cycle = 'monthly' } = body;
  if (!plan_id) throw new Error('plan_id required');

  const { data: plan, error: planErr } = await supabase
    .from('subscription_plans').select('*').eq('id', plan_id).single();
  if (planErr || !plan) throw new Error('Plan not found');

  const amountInr  = billing_cycle === 'annual' ? (plan.price_annual ?? plan.price_monthly * 12) : plan.price_monthly;
  const amountPaise = Math.round(amountInr * 100);   // Razorpay uses paise

  const order = await razorpayPost('/orders', {
    amount:   amountPaise,
    currency: 'INR',
    receipt:  `sub_${tenantId.slice(0,8)}_${Date.now()}`,
    notes: {
      tenant_id:     tenantId,
      plan_id,
      billing_cycle,
      plan_name:     plan.name,
    },
  });

  return {
    order_id:      order.id,
    amount:        amountInr,
    amount_paise:  amountPaise,
    currency:      'INR',
    plan_name:     plan.name,
    billing_cycle,
    razorpay_key:  RAZORPAY_KEY_ID,
  };
}

async function handleVerifyPayment(body: any, userId: string, tenantId: string, supabase: any) {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan_id, billing_cycle = 'monthly' } = body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new Error('Missing payment verification fields');
  }

  const valid = await verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
  if (!valid) throw new Error('Payment signature verification failed');

  // Fetch plan details
  const { data: plan } = await supabase
    .from('subscription_plans').select('*').eq('id', plan_id).single();
  if (!plan) throw new Error('Plan not found');

  const amountInr = billing_cycle === 'annual'
    ? (plan.price_annual ?? plan.price_monthly * 12)
    : plan.price_monthly;

  const now      = new Date();
  const periodEnd = new Date(now);
  if (billing_cycle === 'annual') periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  else periodEnd.setMonth(periodEnd.getMonth() + 1);

  // Cancel any active subscription
  await supabase.from('tenant_subscriptions')
    .update({ status: 'canceled', canceled_at: now.toISOString() })
    .eq('tenant_id', tenantId).eq('status', 'active');

  // Create new subscription
  const { data: sub, error: subErr } = await supabase.from('tenant_subscriptions').insert({
    tenant_id:             tenantId,
    plan_id,
    status:                'active',
    billing_cycle,
    amount_inr:            amountInr,
    current_period_start:  now.toISOString(),
    current_period_end:    periodEnd.toISOString(),
    next_billing_at:       periodEnd.toISOString(),
    razorpay_subscription_id: razorpay_payment_id,
  }).select().single();
  if (subErr) throw new Error('Failed to create subscription: ' + subErr.message);

  // Update tenant subscription_tier
  await supabase.from('tenants')
    .update({ subscription_tier: plan.tier })
    .eq('id', tenantId);

  // Fetch tenant for invoice
  const { data: tenant } = await supabase.from('tenants')
    .select('name, gstin, billing_address').eq('id', tenantId).single();

  // Generate invoice
  const invoice = await createInvoice({
    supabase, tenantId,
    subscriptionId: sub.id,
    plan, amountInr, billing_cycle, now, periodEnd, tenant,
    razorpayOrderId:   razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
  });

  // Record payment
  await supabase.from('billing_payments').insert({
    tenant_id:          tenantId,
    invoice_id:         invoice.id,
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
    amount_inr:         amountInr,
    method:             'razorpay',
    status:             'captured',
    captured_at:        now.toISOString(),
    metadata:           { plan_id, billing_cycle },
  });

  return { subscription: sub, invoice, status: 'active' };
}

async function createInvoice(opts: {
  supabase: any, tenantId: string, subscriptionId: string,
  plan: any, amountInr: number, billing_cycle: string,
  now: Date, periodEnd: Date, tenant: any,
  razorpayOrderId: string, razorpayPaymentId: string,
}) {
  const { supabase, tenantId, subscriptionId, plan, amountInr, billing_cycle,
          now, periodEnd, tenant, razorpayOrderId, razorpayPaymentId } = opts;

  const lineItems = [{
    description: `${plan.name} — ${billing_cycle === 'annual' ? 'Annual' : 'Monthly'} subscription`,
    quantity:    1,
    unit_price:  amountInr,
    amount:      amountInr,
    sac_code:    '998314',
  }];

  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + 7);

  const { data: inv, error: invErr } = await supabase.from('billing_invoices').insert({
    tenant_id:          tenantId,
    subscription_id:    subscriptionId,
    subtotal_inr:       amountInr,
    gst_rate:           18,
    status:             'paid',
    issued_at:          now.toISOString(),
    due_date:           dueDate.toISOString().split('T')[0],
    paid_at:            now.toISOString(),
    gstin_seller:       SELLER_GSTIN,
    gstin_buyer:        tenant?.gstin ?? null,
    is_b2b:             Boolean(tenant?.gstin),
    period_start:       now.toISOString().split('T')[0],
    period_end:         periodEnd.toISOString().split('T')[0],
    razorpay_order_id:  razorpayOrderId,
    razorpay_payment_id: razorpayPaymentId,
    line_items:         lineItems,
  }).select().single();

  if (invErr) console.error('Invoice creation error:', invErr.message);
  return inv;
}

async function handleListInvoices(body: any, tenantId: string, supabase: any) {
  const page  = parseInt(body?.page ?? '1', 10);
  const limit = Math.min(parseInt(body?.limit ?? '10', 10), 50);
  const from  = (page - 1) * limit;

  const { data, count, error } = await supabase
    .from('billing_invoices')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

  if (error) throw new Error(error.message);
  return { invoices: data ?? [], total: count ?? 0, page, limit };
}

async function handleGetInvoice(body: any, tenantId: string, supabase: any) {
  const { invoice_id } = body;
  if (!invoice_id) throw new Error('invoice_id required');

  const { data, error } = await supabase
    .from('billing_invoices')
    .select('*, tenant:tenants(name,gstin,billing_address)')
    .eq('id', invoice_id)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !data) throw new Error('Invoice not found');
  return { invoice: { ...data, seller_name: SELLER_NAME, seller_address: SELLER_ADDR, seller_gstin: SELLER_GSTIN } };
}

async function handleUpdateGstin(body: any, tenantId: string, supabase: any) {
  const { gstin, billing_address } = body;
  const update: Record<string, any> = {};
  if (gstin !== undefined) update.gstin = gstin;
  if (billing_address) update.billing_address = billing_address;

  const { error } = await supabase.from('tenants').update(update).eq('id', tenantId);
  if (error) throw new Error(error.message);
  return { updated: true };
}

// ── Main handler ──────────────────────────────────────────────────────────────

serveWithLogger(async (req: Request, logger: any) => {
  const headers = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  const { user, error: authErr } = await requireAuth(req);
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Resolve tenant_id from user_roles
  const { data: roleRow } = await supabase
    .from('user_roles').select('tenant_id').eq('user_id', user.id).limit(1).single();
  const tenantId = roleRow?.tenant_id;
  if (!tenantId) {
    return new Response(JSON.stringify({ error: 'No tenant found for user' }), { status: 403, headers });
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* no body */ }

  const { action } = body;
  logger.info('billing.action', { action, tenant_id: tenantId });

  try {
    let result: unknown;
    switch (action) {
      case 'create_order':   result = await handleCreateOrder(body, tenantId, supabase); break;
      case 'verify_payment': result = await handleVerifyPayment(body, user.id, tenantId, supabase); break;
      case 'list_invoices':  result = await handleListInvoices(body, tenantId, supabase); break;
      case 'get_invoice':    result = await handleGetInvoice(body, tenantId, supabase); break;
      case 'update_gstin':   result = await handleUpdateGstin(body, tenantId, supabase); break;
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers });
    }
    return new Response(JSON.stringify({ ok: true, data: result }), {
      status: 200, headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    logger.error('billing.error', { action, error: err.message });
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 400, headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
});
