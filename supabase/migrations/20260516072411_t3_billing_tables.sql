-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260516072411; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--


-- Razorpay columns on existing tables
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS razorpay_customer_id text,
  ADD COLUMN IF NOT EXISTS gstin               text,
  ADD COLUMN IF NOT EXISTS billing_address     jsonb NOT NULL DEFAULT '{}';

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS razorpay_plan_id_monthly text,
  ADD COLUMN IF NOT EXISTS razorpay_plan_id_annual  text;

ALTER TABLE public.tenant_subscriptions
  ADD COLUMN IF NOT EXISTS razorpay_subscription_id text,
  ADD COLUMN IF NOT EXISTS billing_cycle            text DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly','annual')),
  ADD COLUMN IF NOT EXISTS next_billing_at          timestamptz,
  ADD COLUMN IF NOT EXISTS amount_inr               numeric(12,2);

-- Invoice sequence
CREATE SEQUENCE IF NOT EXISTS public.billing_invoice_seq START 1001;

-- Invoices table
CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL
    DEFAULT 'INV-' || to_char(now(),'YYYY') || '-' || lpad(nextval('billing_invoice_seq')::text,4,'0'),
  tenant_id      uuid NOT NULL,
  subscription_id uuid REFERENCES public.tenant_subscriptions(id),
  subtotal_inr   numeric(12,2) NOT NULL,
  gst_rate       numeric(5,2)  NOT NULL DEFAULT 18.00,
  gst_amount     numeric(12,2) GENERATED ALWAYS AS (round(subtotal_inr * gst_rate / 100, 2)) STORED,
  total_inr      numeric(12,2) GENERATED ALWAYS AS (subtotal_inr + round(subtotal_inr * gst_rate / 100, 2)) STORED,
  currency       text NOT NULL DEFAULT 'INR',
  status         text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','issued','paid','void','overdue')),
  issued_at      timestamptz,
  due_date       date,
  paid_at        timestamptz,
  gstin_seller   text,
  gstin_buyer    text,
  place_of_supply text,
  sac_code       text NOT NULL DEFAULT '998314',
  is_b2b         boolean NOT NULL DEFAULT false,
  period_start   date,
  period_end     date,
  razorpay_order_id   text,
  razorpay_payment_id text,
  line_items     jsonb NOT NULL DEFAULT '[]',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_invoices_tenant
  ON public.billing_invoices (tenant_id, created_at DESC);

-- Payments table
CREATE TABLE IF NOT EXISTS public.billing_payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL,
  invoice_id          uuid REFERENCES public.billing_invoices(id),
  razorpay_payment_id text UNIQUE,
  razorpay_order_id   text,
  razorpay_signature  text,
  amount_inr          numeric(12,2) NOT NULL,
  currency            text NOT NULL DEFAULT 'INR',
  method              text,
  status              text NOT NULL DEFAULT 'created'
    CHECK (status IN ('created','authorized','captured','refunded','failed')),
  captured_at         timestamptz,
  failure_reason      text,
  metadata            jsonb NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_payments_tenant
  ON public.billing_payments (tenant_id, created_at DESC);

-- Seed INR plans
INSERT INTO public.subscription_plans
  (name, slug, description, plan_type, tier, billing_period,
   price_monthly, price_annual, currency,
   features, limits, trial_period_days, sort_order, is_active)
VALUES
  ('Starter','lnai-starter','Essential tools for individual advisors and small teams.',
   'lnai','starter','monthly',999,9990,'INR',
   '["5 users","2 portfolios","50 AI signals / month","Basic reports","Email support"]'::jsonb,
   '{"users":5,"portfolios":2,"signals_per_month":50,"storage_gb":5}'::jsonb,14,10,true),
  ('Professional','lnai-pro','Advanced analytics and unlimited signals for growing advisory firms.',
   'lnai','professional','monthly',2999,29990,'INR',
   '["25 users","10 portfolios","Unlimited AI signals","F&O signals","PDF reports","Priority support"]'::jsonb,
   '{"users":25,"portfolios":10,"signals_per_month":-1,"storage_gb":50}'::jsonb,14,20,true),
  ('Enterprise','lnai-enterprise','Full platform for large advisory houses.',
   'lnai','enterprise','monthly',7999,79990,'INR',
   '["Unlimited users","Unlimited portfolios","All signal types","Custom domain","Dedicated support","SLA 99.9%"]'::jsonb,
   '{"users":-1,"portfolios":-1,"signals_per_month":-1,"storage_gb":500}'::jsonb,30,30,true)
ON CONFLICT (slug) DO UPDATE SET
  price_monthly=EXCLUDED.price_monthly, price_annual=EXCLUDED.price_annual,
  features=EXCLUDED.features, limits=EXCLUDED.limits, is_active=true;

-- RLS
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_payments  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_read_own_invoices" ON public.billing_invoices FOR SELECT
  USING (tenant_id IN (SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()));
CREATE POLICY "service_write_invoices"   ON public.billing_invoices FOR ALL
  USING (auth.role() = 'service_role');
CREATE POLICY "tenant_read_own_payments" ON public.billing_payments FOR SELECT
  USING (tenant_id IN (SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()));
CREATE POLICY "service_write_payments"   ON public.billing_payments FOR ALL
  USING (auth.role() = 'service_role');
