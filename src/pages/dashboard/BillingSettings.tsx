/**
 * Settings → Billing — pick / change a plan for the active domain.
 *
 * Shows the active tenant's current plan + status (active | trialing |
 * past_due | cancelled), plus a card grid of upgradable plans filtered
 * by the active domain. Each paid plan card has a "Start 14-day trial"
 * CTA that calls useDomainAssignment().startTrial. Trial-active state
 * shows a banner with the days remaining and an "Add card" CTA whose
 * Razorpay capture lands in U-D2.
 *
 * Enterprise plans (or any plan with price 0 + tier=enterprise) skip
 * the trial CTA and surface a "Contact sales" mailto.
 *
 * See docs/plans/2026-05-22-unified-platform-onboarding-design.md
 * §"Package catalog + trial mechanics".
 */
import { useMemo } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { useAuth } from "@/hooks/useAuth";
import { useDomainAssignment } from "@/features/billing/hooks/useDomainAssignment";
import { usePlanCatalog, type SubscriptionPlan } from "@/features/billing/hooks/usePlanCatalog";
import { useStartCardCapture } from "@/features/billing/hooks/useStartCardCapture";

function formatPrice(plan: SubscriptionPlan): string {
  if (plan.price_monthly === 0) return "Free";
  const sym = plan.currency === "INR" ? "₹" : plan.currency === "USD" ? "$" : "";
  return `${sym}${plan.price_monthly.toLocaleString("en-IN", { maximumFractionDigits: 0 })}/mo`;
}

function tierLabel(plan: SubscriptionPlan): string {
  return plan.name;
}

function isFreemium(plan: SubscriptionPlan): boolean {
  return plan.price_monthly === 0 && plan.tier === "free";
}

function isEnterpriseSalesLed(plan: SubscriptionPlan): boolean {
  return plan.tier === "enterprise";
}

export default function BillingSettings() {
  const { profile, user } = useAuth();
  const { assignment, domainId, derived, isLoading, isMutating, startTrial, cancelTrial, TRIAL_DAYS } =
    useDomainAssignment();
  const planCatalog = usePlanCatalog(domainId);
  const { start: startCardCapture, busy: cardBusy } = useStartCardCapture();

  const plans = planCatalog.data ?? [];
  const freemiumPlan = useMemo(() => plans.find(isFreemium), [plans]);
  const currentPlan  = useMemo(
    () => plans.find((p) => p.id === assignment?.plan_id) ?? null,
    [plans, assignment?.plan_id],
  );

  const handleAddCard = async () => {
    if (!assignment?.id || !assignment.plan_id) return;
    await startCardCapture({
      assignmentId:  assignment.id,
      planId:        assignment.plan_id,
      customerEmail: profile?.email ?? user?.email ?? undefined,
      customerName:  [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() || undefined,
    });
  };

  const handleStartTrial = async (plan: SubscriptionPlan) => {
    try {
      await startTrial(plan.id);
      toast.success(`Started your ${plan.name} trial — ${TRIAL_DAYS} days, no card needed.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start trial.");
    }
  };

  const handleCancelTrial = async () => {
    if (!freemiumPlan) {
      toast.error("Free plan unavailable for this domain.");
      return;
    }
    try {
      await cancelTrial(freemiumPlan.id);
      toast.success("Trial cancelled — you're back on the Free plan.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel trial.");
    }
  };

  if (!domainId && !isLoading) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-3xl py-12 text-center text-sm text-muted-foreground">
          Pick a workspace from the topbar switcher first.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Billing & plan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a plan for this workspace. Paid plans start with a {TRIAL_DAYS}-day trial — no card needed.
          </p>
        </header>

        {/* Current state */}
        <CurrentStateCard
          currentPlan={currentPlan}
          derived={derived}
          assignment={assignment}
          isLoading={isLoading}
          onCancelTrial={() => void handleCancelTrial()}
          onAddCard={() => void handleAddCard()}
          isMutating={isMutating || cardBusy}
        />

        {/* Plan grid */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Available plans
          </h2>

          {planCatalog.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading plans…
            </div>
          ) : plans.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No plans configured for this domain yet.
            </p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => (
                <li key={plan.id}>
                  <PlanCard
                    plan={plan}
                    isCurrent={plan.id === assignment?.plan_id}
                    isMutating={isMutating}
                    onStartTrial={() => void handleStartTrial(plan)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}

// ─── Current state card ────────────────────────────────────────────────────

interface CurrentStateProps {
  currentPlan:   SubscriptionPlan | null;
  derived:       ReturnType<typeof useDomainAssignment>["derived"];
  assignment:    ReturnType<typeof useDomainAssignment>["assignment"];
  isLoading:     boolean;
  isMutating:    boolean;
  onCancelTrial: () => void;
  onAddCard:     () => void;
}

function CurrentStateCard({
  currentPlan, derived, assignment, isLoading, isMutating, onCancelTrial, onAddCard,
}: CurrentStateProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-5 text-sm text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading your plan…
        </CardContent>
      </Card>
    );
  }
  if (!currentPlan || !assignment) {
    return null;
  }

  const isTrialing = derived.isTrialing;
  const isPaidActive = derived.isPaidActive;

  return (
    <Card className={cn(isTrialing && "border-primary/40 bg-primary/[0.03]")}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">
              Currently on {currentPlan.name}
            </CardTitle>
            <CardDescription>
              {isTrialing && (
                <>
                  Trial — <span className="font-medium text-foreground">{derived.trialDaysRemaining}</span>{" "}
                  day{derived.trialDaysRemaining === 1 ? "" : "s"} left.{" "}
                  Add a card to keep this plan past trial.
                </>
              )}
              {isPaidActive && "Paid plan — billed monthly via Razorpay."}
              {derived.isFreemium && "Free plan. Upgrade to unlock more users + features."}
              {assignment.subscription_status === "past_due" && "Payment past due — please update your card."}
              {assignment.subscription_status === "cancelled" && "Plan cancelled. You're on read-only access."}
            </CardDescription>
          </div>
          {isTrialing && (
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" />
              Trial
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2 pt-0">
        {isTrialing && (
          <>
            <Button onClick={onAddCard} disabled={isMutating}>
              {isMutating ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Opening checkout…
                </span>
              ) : "Add card to keep this plan"}
            </Button>
            <Button variant="ghost" onClick={onCancelTrial} disabled={isMutating}>
              Cancel trial & go back to Free
            </Button>
          </>
        )}
        {isPaidActive && (
          <Button variant="outline" disabled title="Cancel pathway is part of U-D3 follow-ups">
            Manage subscription
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Plan card ─────────────────────────────────────────────────────────────

interface PlanCardProps {
  plan:         SubscriptionPlan;
  isCurrent:    boolean;
  isMutating:   boolean;
  onStartTrial: () => void;
}

function PlanCard({ plan, isCurrent, isMutating, onStartTrial }: PlanCardProps) {
  const free        = isFreemium(plan);
  const salesLed    = isEnterpriseSalesLed(plan);
  const features    = Array.isArray(plan.features) ? plan.features : [];

  return (
    <Card className={cn("flex h-full flex-col", isCurrent && "border-primary ring-1 ring-primary")}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{tierLabel(plan)}</CardTitle>
          {isCurrent && <Badge variant="secondary" className="text-[10px]">Current</Badge>}
        </div>
        <p className="text-2xl font-semibold tabular-nums leading-tight">
          {formatPrice(plan)}
        </p>
        {plan.description && (
          <CardDescription className="leading-snug">{plan.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        {features.length > 0 && (
          <ul className="space-y-1.5 text-xs">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-1.5">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="text-muted-foreground">{f}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <CardContent className="pt-0">
        {isCurrent ? (
          <Button variant="ghost" disabled className="w-full">
            You're on this plan
          </Button>
        ) : free ? (
          <Button variant="outline" disabled className="w-full" title="Free plan is the default — switch from Trial via Cancel">
            Default plan
          </Button>
        ) : salesLed ? (
          <Button asChild variant="outline" className="w-full">
            <a href="mailto:sales@sosservices.online">Contact sales</a>
          </Button>
        ) : (
          <Button onClick={onStartTrial} disabled={isMutating} className="w-full">
            {isMutating ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Starting trial…
              </span>
            ) : (
              "Start 14-day trial"
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
