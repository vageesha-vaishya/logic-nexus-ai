/**
 * useStartCardCapture — opens Razorpay Checkout for a trial → paid
 * conversion and flips the active domain assignment to status='active'
 * on success.
 *
 * Flow:
 *   1. POST domain-subscription { action: 'create_payment', assignment_id, plan_id }
 *      → returns { order_id, amount, currency, key_id }
 *   2. Load https://checkout.razorpay.com/v1/checkout.js (once per session)
 *   3. Razorpay.open({ key, order_id, ..., handler })
 *   4. handler() runs on success → POST { action: 'confirm_payment', ... }
 *   5. Refresh the assignment cache so the page shows the paid state.
 *
 * Returns a single { start } async function. The Razorpay widget is
 * mounted by Razorpay itself (no React tree component needed).
 *
 * If the edge function returns razorpay_not_configured (503), this
 * surfaces a sonner toast and resolves to false — BillingSettings then
 * keeps the "Add card (coming soon)" affordance.
 */
import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay?: new (options: any) => { open: () => void };
  }
}

let scriptLoadingPromise: Promise<boolean> | null = null;

function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (scriptLoadingPromise) return scriptLoadingPromise;
  scriptLoadingPromise = new Promise((resolve) => {
    const s = document.createElement("script");
    s.src   = RAZORPAY_SCRIPT_URL;
    s.async = true;
    s.onload  = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
  return scriptLoadingPromise;
}

interface CreatePaymentResponse {
  ok:        boolean;
  order_id?:  string;
  amount?:    number;
  currency?:  string;
  key_id?:    string;
  plan_name?: string;
  code?:      string;
  message?:   string;
}

interface StartArgs {
  assignmentId: string;
  planId:       string;
  /** Used to prefill Razorpay's contact field. */
  customerEmail?: string;
  customerName?:  string;
}

export function useStartCardCapture() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  // Eager probe — load the SDK script so the first click is fast.
  useEffect(() => {
    void loadRazorpayScript().then(setAvailable);
  }, []);

  const start = useCallback(async (args: StartArgs): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    try {
      const sdkOk = await loadRazorpayScript();
      if (!sdkOk || !window.Razorpay) {
        toast.error("Couldn't load the payment widget — check your network and retry.");
        return false;
      }

      const { data, error } = await supabase.functions.invoke<CreatePaymentResponse>(
        "domain-subscription",
        { body: { action: "create_payment", assignment_id: args.assignmentId, plan_id: args.planId } },
      );

      if (error || !data?.ok || !data.order_id || !data.key_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ctx = (error as any)?.context?.json ?? data;
        const code    = ctx?.code    as string | undefined;
        const message = ctx?.message as string | undefined;
        if (code === "razorpay_not_configured") {
          toast.error("Razorpay isn't connected yet — ask the operator to set the API keys.");
        } else {
          toast.error(message ?? error?.message ?? "Couldn't start payment.");
        }
        return false;
      }

      return await new Promise<boolean>((resolve) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rzp = new window.Razorpay!({
          key:         data.key_id,
          order_id:    data.order_id,
          amount:      data.amount,
          currency:    data.currency,
          name:        data.plan_name ?? "Subscription",
          description: `Activate ${data.plan_name ?? "your plan"}`,
          prefill: {
            email: args.customerEmail,
            name:  args.customerName,
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          handler: async (resp: any) => {
            const { data: confirm, error: confirmErr } = await supabase.functions.invoke(
              "domain-subscription",
              {
                body: {
                  action:                "confirm_payment",
                  assignment_id:         args.assignmentId,
                  plan_id:               args.planId,
                  razorpay_order_id:     resp.razorpay_order_id,
                  razorpay_payment_id:   resp.razorpay_payment_id,
                  razorpay_signature:    resp.razorpay_signature,
                },
              },
            );
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const cdata = confirm as any;
            if (confirmErr || !cdata?.ok) {
              toast.error(cdata?.message ?? confirmErr?.message ?? "Payment captured but activation failed.");
              resolve(false);
              return;
            }
            toast.success("Payment confirmed — you're on the paid plan.");
            qc.invalidateQueries({ queryKey: ["tenant-domain-assignment"] });
            resolve(true);
          },
          modal: {
            ondismiss: () => resolve(false),
          },
        });
        rzp.open();
      });
    } finally {
      setBusy(false);
    }
  }, [busy, qc]);

  return { start, busy, available };
}
