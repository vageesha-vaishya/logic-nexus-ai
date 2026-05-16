import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import {
  Activity, ArrowRight, BadgeCheck, Calendar, CheckCircle2,
  CreditCard, ExternalLink, Loader2, Package, RefreshCw,
  ShieldCheck, Sparkles, TrendingUp, Users, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Badge, Button, Card, CardContent, CardDescription,
  CardFooter, CardHeader, CardTitle,
  Separator, Skeleton, Switch, Tooltip, TooltipContent,
  TooltipProvider, TooltipTrigger,
} from "@/design-system";
import { useCRM } from "@/hooks/useCRM";
import {
  useLnaiPlans, useCurrentSubscription, useInvoices,
  useRazorpayCheckout,
  type BillingPlan, type BillingInvoice,
} from "@/features/billing/hooks/useBilling";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtINR(n: number | string | null | undefined): string {
  if (n == null) return "₹0";
  return "₹" + Number(n).toLocaleString("en-IN");
}

const TIER_COLORS: Record<string, string> = {
  starter:      "bg-blue-500/10 text-blue-600 border-blue-200",
  professional: "bg-violet-500/10 text-violet-600 border-violet-200",
  enterprise:   "bg-amber-500/10 text-amber-600 border-amber-200",
};

const STATUS_COLORS: Record<string, string> = {
  active:   "bg-emerald-500/10 text-emerald-600",
  trial:    "bg-blue-500/10 text-blue-600",
  past_due: "bg-red-500/10 text-red-500",
  canceled: "bg-gray-500/10 text-gray-500",
  paused:   "bg-amber-500/10 text-amber-600",
};

const INVOICE_STATUS: Record<string, string> = {
  paid:    "bg-emerald-100 text-emerald-700",
  issued:  "bg-blue-100 text-blue-700",
  overdue: "bg-red-100 text-red-600",
  draft:   "bg-gray-100 text-gray-600",
  void:    "bg-gray-100 text-gray-400 line-through",
};

// ── Plan card ─────────────────────────────────────────────────────────────────

function PlanCard({
  plan, isCurrentPlan, annual, onSelect, loading,
}: {
  plan: BillingPlan;
  isCurrentPlan: boolean;
  annual: boolean;
  onSelect: (plan: BillingPlan) => void;
  loading: boolean;
}) {
  const price    = annual ? Math.floor((plan.price_annual ?? plan.price_monthly * 12) / 12) : plan.price_monthly;
  const savings  = annual && plan.price_annual
    ? plan.price_monthly * 12 - plan.price_annual : 0;
  const isPro    = plan.tier === "professional";
  const features = Array.isArray(plan.features) ? plan.features as string[] : [];

  return (
    <Card className={`relative flex flex-col transition-all ${
      isPro ? "border-violet-400 shadow-lg ring-1 ring-violet-300" :
      isCurrentPlan ? "border-primary" : "hover:border-muted-foreground/40"
    }`}>
      {isPro && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-violet-600 text-white px-3 py-0.5 text-xs">
            <Sparkles className="mr-1 h-3 w-3" /> Most Popular
          </Badge>
        </div>
      )}
      {isCurrentPlan && (
        <div className="absolute -top-3 right-4">
          <Badge variant="outline" className="bg-background border-primary text-primary text-xs">
            <BadgeCheck className="mr-1 h-3 w-3" /> Current Plan
          </Badge>
        </div>
      )}

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{plan.name}</CardTitle>
          {plan.tier && (
            <Badge variant="outline" className={`text-xs ${TIER_COLORS[plan.tier] ?? ""}`}>
              {plan.tier}
            </Badge>
          )}
        </div>
        {plan.description && (
          <CardDescription className="text-xs leading-relaxed mt-1">
            {plan.description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        {/* Price */}
        <div>
          <div className="flex items-end gap-1">
            <span className="text-3xl font-bold">{fmtINR(price)}</span>
            <span className="text-muted-foreground text-sm mb-1">/mo</span>
          </div>
          {annual && plan.price_annual && (
            <div className="text-xs text-muted-foreground">
              Billed annually — <span className="text-emerald-600 font-medium">save {fmtINR(savings)}/yr</span>
            </div>
          )}
          {!annual && (
            <div className="text-xs text-muted-foreground">Billed monthly</div>
          )}
          {plan.trial_period_days && !isCurrentPlan && (
            <div className="text-xs text-blue-600 mt-1">
              {plan.trial_period_days}-day free trial
            </div>
          )}
        </div>

        {/* Features */}
        <ul className="space-y-1.5">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
              {f}
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter className="pt-0">
        <Button
          className="w-full"
          variant={isPro ? "default" : isCurrentPlan ? "outline" : "outline"}
          onClick={() => onSelect(plan)}
          disabled={loading || isCurrentPlan}
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isCurrentPlan ? "Current Plan" : "Get Started"}
          {!isCurrentPlan && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>
      </CardFooter>
    </Card>
  );
}

// ── Invoice row ───────────────────────────────────────────────────────────────

function InvoiceRow({ inv, onView }: { inv: BillingInvoice; onView: (id: string) => void }) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <div className="font-mono text-sm font-medium">{inv.invoice_number}</div>
          <div className="text-xs text-muted-foreground">
            {inv.issued_at ? format(new Date(inv.issued_at), "dd MMM yyyy") : "—"}
            {inv.period_start && inv.period_end
              ? ` · ${format(new Date(inv.period_start), "MMM yyyy")} – ${format(new Date(inv.period_end), "MMM yyyy")}`
              : ""}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${INVOICE_STATUS[inv.status] ?? ""}`}>
          {inv.status.toUpperCase()}
        </span>
        <span className="font-semibold tabular-nums">
          ₹{Number(inv.total_inr).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </span>
        <Button variant="ghost" size="sm" onClick={() => onView(inv.id)}>
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SubscriptionManagement() {
  const [annual, setAnnual] = useState(false);
  const [invoicePage, setInvoicePage] = useState(1);
  const { context, user } = useCRM();
  const navigate = useNavigate();

  const plansQ   = useLnaiPlans();
  const subQ     = useCurrentSubscription(context.tenantId);
  const invoicesQ = useInvoices(invoicePage);
  const { checkout, loading: checkoutLoading } = useRazorpayCheckout();

  const currentSub  = subQ.data;
  const currentPlan = currentSub?.subscription_plans;

  const handleSelectPlan = async (plan: BillingPlan) => {
    if (!user?.email) { toast.error("User email not found"); return; }
    await checkout({
      planId:       plan.id,
      billingCycle: annual ? "annual" : "monthly",
      tenantName:   context.tenantName ?? "Your Organisation",
      userEmail:    user.email,
    });
    subQ.refetch();
    invoicesQ.refetch();
  };

  const invoiceData = invoicesQ.data;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-8 p-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              Subscription & Billing
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage your plan, payments, and GST invoices.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { subQ.refetch(); invoicesQ.refetch(); }}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        </div>

        {/* Current subscription summary */}
        {subQ.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {[0,1,2].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : currentSub ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Active Plan</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{currentPlan?.name}</div>
                <Badge className={`mt-1 text-xs ${STATUS_COLORS[currentSub.status] ?? ""}`} variant="outline">
                  {currentSub.status}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  {currentSub.billing_cycle === "annual" ? "Annual" : "Monthly"} Cost
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">
                  {currentSub.amount_inr
                    ? fmtINR(currentSub.billing_cycle === "annual"
                        ? Math.floor(currentSub.amount_inr / 12)
                        : currentSub.amount_inr)
                    : fmtINR(currentPlan?.price_monthly ?? 0)}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </div>
                {currentSub.billing_cycle === "annual" && (
                  <p className="text-xs text-muted-foreground">
                    {fmtINR(currentSub.amount_inr ?? 0)} billed annually
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Next Renewal</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">
                  {format(new Date(currentSub.current_period_end), "dd MMM")}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(currentSub.current_period_end), { addSuffix: true })}
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
              <Activity className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <div className="font-medium">No active subscription</div>
                <div className="text-sm text-muted-foreground">Choose a plan below to get started</div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Plans */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Available Plans</h2>
              <p className="text-sm text-muted-foreground">All prices in INR, inclusive of GST</p>
            </div>
            {/* Annual toggle */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 rounded-full border px-3 py-1.5 cursor-pointer"
                    onClick={() => setAnnual(v => !v)}>
                    <span className={`text-xs font-medium ${!annual ? "text-foreground" : "text-muted-foreground"}`}>
                      Monthly
                    </span>
                    <Switch checked={annual} onCheckedChange={setAnnual} className="scale-75" />
                    <span className={`text-xs font-medium ${annual ? "text-foreground" : "text-muted-foreground"}`}>
                      Annual
                    </span>
                    {annual && (
                      <Badge className="bg-emerald-100 text-emerald-700 text-xs px-1.5 py-0 h-4">
                        Save 2 months
                      </Badge>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>Annual billing saves ~17% vs monthly</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {plansQ.isLoading ? (
            <div className="grid gap-6 md:grid-cols-3">
              {[0,1,2].map(i => <Skeleton key={i} className="h-80 rounded-xl" />)}
            </div>
          ) : plansQ.data?.length === 0 ? (
            <Card className="border-dashed p-8 text-center text-muted-foreground">
              No plans available. Contact support.
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-3">
              {(plansQ.data ?? []).map(plan => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  isCurrentPlan={currentSub?.plan_id === plan.id}
                  annual={annual}
                  onSelect={handleSelectPlan}
                  loading={checkoutLoading}
                />
              ))}
            </div>
          )}

          {/* Trust badges */}
          <div className="flex flex-wrap gap-6 justify-center pt-2">
            {[
              { icon: ShieldCheck, label: "SSL Secured Payment" },
              { icon: Zap, label: "Instant Activation" },
              { icon: Users, label: "Cancel Anytime" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Billing history */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Billing History</h2>
            {invoiceData && invoiceData.total > 0 && (
              <span className="text-xs text-muted-foreground">
                {invoiceData.total} invoice{invoiceData.total !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              {invoicesQ.isLoading ? (
                <div className="p-4 space-y-3">
                  {[0,1,2].map(i => <Skeleton key={i} className="h-12 rounded" />)}
                </div>
              ) : !invoiceData?.invoices?.length ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <CreditCard className="h-8 w-8" />
                  <div className="text-sm">No invoices yet. Your payment receipts will appear here.</div>
                </div>
              ) : (
                <div className="px-4 pt-1">
                  {invoiceData.invoices.map(inv => (
                    <InvoiceRow
                      key={inv.id}
                      inv={inv}
                      onView={(id) => navigate(`/dashboard/billing/invoices/${id}`)}
                    />
                  ))}
                </div>
              )}
            </CardContent>

            {invoiceData && invoiceData.total > invoiceData.limit && (
              <CardFooter className="justify-center gap-2 pt-3">
                <Button
                  variant="outline" size="sm"
                  disabled={invoicePage === 1}
                  onClick={() => setInvoicePage(p => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground px-2">
                  Page {invoicePage} of {Math.ceil(invoiceData.total / invoiceData.limit)}
                </span>
                <Button
                  variant="outline" size="sm"
                  disabled={invoicePage >= Math.ceil(invoiceData.total / invoiceData.limit)}
                  onClick={() => setInvoicePage(p => p + 1)}
                >
                  Next
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>

        {/* GST note */}
        <div className="rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-medium">GST Invoice:</span> All payments include 18% GST (SAC 998314 — Software as a Service).
              GST invoices are generated automatically and available for download.
              For B2B billing with your GSTIN, go to{" "}
              <a href="/dashboard/settings" className="underline hover:text-foreground">Settings → Billing</a>.
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
