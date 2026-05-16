/**
 * useBilling — Razorpay + invoice hooks for the billing feature.
 *
 * All calls go through the billing-razorpay edge function.
 * Razorpay Checkout JS is loaded lazily from the CDN.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BillingPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  price_annual: number | null;
  tier: string | null;
  features: string[];
  limits: Record<string, number>;
  trial_period_days: number | null;
  is_active: boolean;
  currency: string;
  plan_type: string;
}

export interface BillingSubscription {
  id: string;
  plan_id: string;
  status: "active" | "trial" | "past_due" | "canceled" | "paused";
  billing_cycle: "monthly" | "annual";
  current_period_start: string;
  current_period_end: string;
  next_billing_at: string | null;
  amount_inr: number | null;
  subscription_plans: BillingPlan;
}

export interface BillingInvoice {
  id: string;
  invoice_number: string;
  status: "draft" | "issued" | "paid" | "void" | "overdue";
  subtotal_inr: number;
  gst_rate: number;
  gst_amount: number;
  total_inr: number;
  currency: string;
  issued_at: string | null;
  paid_at: string | null;
  period_start: string | null;
  period_end: string | null;
  gstin_buyer: string | null;
  sac_code: string;
  line_items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
    sac_code: string;
  }>;
  // injected by edge fn
  seller_name?: string;
  seller_address?: string;
  seller_gstin?: string;
}

// ── Edge function caller ──────────────────────────────────────────────────────

async function callBilling(action: string, params: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const res = await supabase.functions.invoke("billing-razorpay", {
    body: { action, ...params },
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.error) throw new Error(res.error.message ?? "Billing error");
  if (!res.data?.ok) throw new Error(res.data?.error ?? "Unknown billing error");
  return res.data.data;
}

// ── Plans query (public — no auth needed) ─────────────────────────────────────

export function useLnaiPlans() {
  return useQuery<BillingPlan[]>({
    queryKey: ["billing", "plans"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("plan_type", "lnai")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw new Error(error.message);
      return (data ?? []) as BillingPlan[];
    },
  });
}

// ── Current subscription ──────────────────────────────────────────────────────

export function useCurrentSubscription(tenantId: string | null | undefined) {
  return useQuery<BillingSubscription | null>({
    queryKey: ["billing", "subscription", tenantId],
    enabled: Boolean(tenantId),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_subscriptions")
        .select("*, subscription_plans(*)")
        .eq("tenant_id", tenantId!)
        .in("status", ["active", "trial"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) console.warn("Subscription fetch:", error.message);
      return data as BillingSubscription | null;
    },
  });
}

// ── Invoices ──────────────────────────────────────────────────────────────────

export function useInvoices(page = 1) {
  return useQuery({
    queryKey: ["billing", "invoices", page],
    staleTime: 60_000,
    queryFn: () => callBilling("list_invoices", { page, limit: 10 }) as Promise<{
      invoices: BillingInvoice[];
      total: number;
      page: number;
      limit: number;
    }>,
  });
}

export function useInvoiceDetail(invoiceId: string | null) {
  return useQuery({
    queryKey: ["billing", "invoice", invoiceId],
    enabled: Boolean(invoiceId),
    staleTime: 5 * 60_000,
    queryFn: () => callBilling("get_invoice", { invoice_id: invoiceId }) as Promise<{ invoice: BillingInvoice }>,
  });
}

// ── Update GSTIN ──────────────────────────────────────────────────────────────

export function useUpdateGstin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { gstin?: string; billing_address?: Record<string, string> }) =>
      callBilling("update_gstin", params),
    onSuccess: () => {
      toast.success("GSTIN updated");
      queryClient.invalidateQueries({ queryKey: ["billing"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Razorpay checkout ─────────────────────────────────────────────────────────

declare global {
  interface Window {
    Razorpay: any;
  }
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) { resolve(); return; }
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload  = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Razorpay checkout"));
    document.head.appendChild(s);
  });
}

export interface CheckoutParams {
  planId: string;
  billingCycle: "monthly" | "annual";
  tenantName: string;
  userEmail: string;
  userPhone?: string;
}

export function useRazorpayCheckout() {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const checkout = async (params: CheckoutParams): Promise<void> => {
    setLoading(true);
    try {
      await loadRazorpayScript();

      // 1. Create order on server
      const orderData = await callBilling("create_order", {
        plan_id:       params.planId,
        billing_cycle: params.billingCycle,
      }) as {
        order_id: string; amount: number; amount_paise: number;
        plan_name: string; razorpay_key: string;
      };

      // 2. Open Razorpay checkout
      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay({
          key:         orderData.razorpay_key,
          amount:      orderData.amount_paise,
          currency:    "INR",
          name:        "Logic Nexus AI",
          description: `${orderData.plan_name} — ${params.billingCycle}`,
          order_id:    orderData.order_id,
          prefill: {
            name:  params.tenantName,
            email: params.userEmail,
            contact: params.userPhone ?? "",
          },
          theme: { color: "#2563eb" },
          handler: async (response: {
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
          }) => {
            try {
              await callBilling("verify_payment", {
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
                plan_id:             params.planId,
                billing_cycle:       params.billingCycle,
              });
              toast.success("Payment successful! Subscription activated.");
              queryClient.invalidateQueries({ queryKey: ["billing"] });
              resolve();
            } catch (e: any) {
              reject(e);
            }
          },
          modal: {
            ondismiss: () => reject(new Error("Payment cancelled")),
          },
        });
        rzp.open();
      });
    } catch (e: any) {
      if (e.message !== "Payment cancelled") toast.error(e.message ?? "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  return { checkout, loading };
}
