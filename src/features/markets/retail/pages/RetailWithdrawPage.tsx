import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Banknote,
  CalendarClock,
  Info,
  Landmark,
  Percent,
  Receipt,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { useBrokerConnections } from "../../hooks/useBrokerConnections";
import { usePortfolios } from "../../hooks/usePortfolios";
import { Term, WhyButton } from "../glossary";
import {
  ASSET_CLASS_LABEL,
  computeExitLoad,
  computeSettlementDate,
  computeTaxImpact,
  type AssetClass,
} from "../withdraw/withdrawMath";

const formatINR = (n: number): string =>
  n === 0 ? "₹0" : `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

function formatDate(iso: string): string {
  // "Mon, 23 Mar 2026" — Indian audience prefers DD MMM YYYY.
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day:     "numeric",
    month:   "short",
    year:    "numeric",
  });
}

/**
 * Withdraw projection screen (Phase 1 Addendum T16 §8g).
 *
 * Education-first, non-executing: shows the user what to expect when they
 * pull money out — settlement timeline, exit loads, tax impact, bank routing.
 * The actual redemption still happens through the linked broker app for
 * Phase 1; we surface the calculus before they take that step so they
 * don't get blindsided by tax or exit loads.
 *
 * Inputs are simple enough that the projection updates live as the user
 * types — no submit button, no server round-trip.
 */
export default function RetailWithdrawPage() {
  // Form state — all client-side, all updates the projection cards live.
  const [portfolioId, setPortfolioId]     = useState<string>("");
  const [assetClass,  setAssetClass]      = useState<AssetClass>("equity");
  const [amount,      setAmount]          = useState<string>("");
  const [holdingYears, setHoldingYears]   = useState<string>("1");
  const [estimatedGain, setEstimatedGain] = useState<string>("");

  const { data: portfolios = [] }  = usePortfolios();
  const { data: connections = [] } = useBrokerConnections();
  const activeBroker = connections.find((c) => c.status === "active") ?? connections[0];

  const amountNum = Number(amount) || 0;
  const gainNum   = Number(estimatedGain) || 0;
  const yearsNum  = Number(holdingYears) || 0;
  const monthsHeld = Math.max(0, Math.round(yearsNum * 12));

  const settlement = useMemo(
    () => computeSettlementDate(new Date(), assetClass),
    [assetClass],
  );

  const exitLoad = useMemo(
    () => computeExitLoad(amountNum, monthsHeld, assetClass),
    [amountNum, monthsHeld, assetClass],
  );

  const tax = useMemo(
    // Until we wire LTCG-room-left from holdings history, assume full
    // ₹1.25L exemption available. T15 (LTCG tracker) will plumb the real
    // value into this call when it lands.
    () => computeTaxImpact(gainNum, yearsNum, 125_000, assetClass),
    [gainNum, yearsNum, assetClass],
  );

  const netReceived = Math.max(0, amountNum - exitLoad.amount - tax.total);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
      {/* Header with back-to-More link */}
      <div className="space-y-1">
        <Link
          to="/dashboard/markets/retail/more"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to More
        </Link>
        <h2 className="text-lg font-semibold">Withdraw</h2>
        <p className="text-xs text-muted-foreground">
          See what to expect before redeeming. Settlement, exit loads, tax —
          all estimated below. We don&apos;t execute the withdrawal here; do
          that in your broker app.
        </p>
      </div>

      {/* Step 1: form */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="wd-portfolio" className="text-xs">
                Portfolio
              </Label>
              <Select value={portfolioId} onValueChange={setPortfolioId}>
                <SelectTrigger id="wd-portfolio" className="h-8 text-xs">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {portfolios.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="wd-asset" className="text-xs">
                <Term word="asset class">Asset class</Term>
              </Label>
              <Select
                value={assetClass}
                onValueChange={(v) => setAssetClass(v as AssetClass)}
              >
                <SelectTrigger id="wd-asset" className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ASSET_CLASS_LABEL) as AssetClass[]).map((ac) => (
                    <SelectItem key={ac} value={ac}>
                      {ASSET_CLASS_LABEL[ac]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="wd-amount" className="text-xs">
                Amount (₹)
              </Label>
              <Input
                id="wd-amount"
                type="number"
                inputMode="numeric"
                min={0}
                className="h-8 text-xs"
                placeholder="e.g. 100000"
                value={amount}
                onChange={(e) => setAmount(e.target.value.trim())}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wd-years" className="text-xs">
                Held (yrs)
              </Label>
              <Input
                id="wd-years"
                type="number"
                inputMode="decimal"
                step="0.1"
                min={0}
                className="h-8 text-xs"
                placeholder="e.g. 1.5"
                value={holdingYears}
                onChange={(e) => setHoldingYears(e.target.value.trim())}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wd-gain" className="text-xs">
                <Term word="ltcg">Est. gain</Term> (₹)
              </Label>
              <Input
                id="wd-gain"
                type="number"
                inputMode="numeric"
                min={0}
                className="h-8 text-xs"
                placeholder="e.g. 20000"
                value={estimatedGain}
                onChange={(e) => setEstimatedGain(e.target.value.trim())}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: 4 projection cards */}
      <SettlementCard
        label={settlement.label}
        dateLabel={formatDate(settlement.dateISO)}
        days={settlement.businessDaysOut}
      />

      <ExitLoadCard
        amount={exitLoad.amount}
        reason={exitLoad.reason}
      />

      <TaxImpactCard
        stcg={tax.stcg}
        ltcg={tax.ltcg}
        breakdown={tax.breakdown}
        exemptionLeft={tax.exemptionLeft}
      />

      <BankRoutingCard
        brokerName={activeBroker?.display_name ?? null}
        status={activeBroker?.status ?? null}
        clientId={activeBroker?.broker_client_id ?? null}
      />

      {/* Net summary footer */}
      <Card className="border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30">
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Estimated net to bank</p>
            <p className="text-xl font-semibold tabular-nums">
              {formatINR(netReceived)}
            </p>
          </div>
          <div className="text-right text-[11px] text-muted-foreground tabular-nums">
            <div>Withdraw {formatINR(amountNum)}</div>
            <div>− Exit {formatINR(exitLoad.amount)}</div>
            <div>− Tax {formatINR(tax.total)}</div>
          </div>
        </CardContent>
      </Card>

      <p className="rounded-md bg-muted/30 p-2.5 text-[11px] leading-snug text-muted-foreground">
        <Info className="mb-0.5 mr-1 inline h-3 w-3" />
        Estimates only. Exact tax depends on your earlier capital gains this
        FY, FIFO basis, and per-trade history we don&apos;t fully model here.
        F&O gains are taxed as business income, not capital gains — consult
        a CA before filing.
      </p>
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function SettlementCard({
  label,
  dateLabel,
  days,
}: {
  label: string;
  dateLabel: string;
  days: number;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" />
          Settlement
        </h3>
        <p className="text-sm">
          Funds typically reach your bank by{" "}
          <span className="font-semibold">{dateLabel}</span>{" "}
          <Badge variant="outline" className="text-[10px]">
            T+{days}
          </Badge>
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function ExitLoadCard({
  amount,
  reason,
}: {
  amount: number;
  reason: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
          <Percent className="h-3.5 w-3.5" />
          Exit load
        </h3>
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              "text-lg font-semibold tabular-nums",
              amount > 0 ? "text-amber-700 dark:text-amber-300" : "",
            )}
          >
            {formatINR(amount)}
          </span>
          <span className="text-right text-xs text-muted-foreground">{reason}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function TaxImpactCard({
  stcg,
  ltcg,
  breakdown,
  exemptionLeft,
}: {
  stcg: number;
  ltcg: number;
  breakdown: string;
  exemptionLeft: number;
}) {
  const total = stcg + ltcg;
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
          <Receipt className="h-3.5 w-3.5" />
          Tax impact (est.)
          <WhyButton
            title="How is this calculated?"
            srLabel="How is tax calculated?"
          >
            STCG (held &lt; 1 yr) = 20% of gain. LTCG (held ≥ 1 yr) = 12.5%
            of gain above the ₹1.25L per-FY exemption. Debt MF gains follow
            slab rates (we estimate at the top slab — your real rate may be
            lower).
          </WhyButton>
        </h3>
        <div className="flex items-baseline justify-between gap-2">
          <span className={cn(
            "text-lg font-semibold tabular-nums",
            total > 0 ? "text-rose-600 dark:text-rose-400" : "",
          )}>
            {formatINR(total)}
          </span>
          <span className="text-right text-[11px] tabular-nums text-muted-foreground">
            Exemption left: {formatINR(exemptionLeft)}
          </span>
        </div>
        <p className="text-xs leading-snug text-muted-foreground">{breakdown}</p>
      </CardContent>
    </Card>
  );
}

function BankRoutingCard({
  brokerName,
  status,
  clientId,
}: {
  brokerName: string | null;
  status: string | null;
  clientId: string | null;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
          <Landmark className="h-3.5 w-3.5" />
          Funds routed to
        </h3>
        {brokerName ? (
          <>
            <p className="flex items-center gap-1.5 text-sm">
              <Banknote className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">{brokerName}</span>
              {status === "active" ? (
                <Badge variant="default" className="text-[10px]">
                  active
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">
                  {status ?? "—"}
                </Badge>
              )}
            </p>
            {clientId && (
              <p className="text-xs text-muted-foreground">Client ID: {clientId}</p>
            )}
            <p className="text-[11px] leading-snug text-muted-foreground">
              Funds settle into the bank account linked with this broker.
              Check your broker app for the exact account.
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            No broker connected.{" "}
            <Link
              to="/dashboard/markets/settings/brokers"
              className="font-medium text-foreground underline underline-offset-2"
            >
              Connect a broker
            </Link>{" "}
            to see where your withdrawal lands.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
