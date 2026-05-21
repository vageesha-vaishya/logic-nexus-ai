/**
 * Stress-test panel — Phase 1 Addendum T18.
 *
 * Sheet reached from the RiskScoreCard's "Stress test" CTA. Shows the
 * user's current portfolio impact under three historical scenarios
 * (COVID 2020, GFC 2008, Adani 2023) with tabs and per-scenario worst-3
 * holdings highlighted.
 *
 * The math (per-symbol returns × current value, top-3 sort) is server-side
 * — see services/markets-worker/src/markets_worker/routers/stress_test.py.
 * This component is presentational only.
 */
import { AlertTriangle } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/format";

import { useStressTest, type StressTestScenario } from "../hooks/useStressTest";

interface StressTestPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StressTestPanel({ open, onOpenChange }: StressTestPanelProps) {
  const { data, isLoading, isError } = useStressTest(open);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden />
            Stress test
          </SheetTitle>
          <SheetDescription>
            What would happen to your portfolio if these historical crashes
            repeated today? Returns are applied to your current holdings
            symbol-by-symbol.
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : isError || !data ? (
          <p className="text-sm text-muted-foreground">
            Couldn't load stress test. Retry by closing and reopening this panel.
          </p>
        ) : data.holdings_count === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add holdings to your portfolio to see how they'd hold up under
            historical crashes.
          </p>
        ) : (
          <ScenarioTabs portfolioValue={data.portfolio_value} scenarios={data.scenarios} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function ScenarioTabs({
  portfolioValue,
  scenarios,
}: {
  portfolioValue: number;
  scenarios: StressTestScenario[];
}) {
  // Worst scenario first — that's the one the user most needs to see.
  const ordered = [...scenarios].sort((a, b) => a.loss_inr - b.loss_inr);
  const defaultCode = ordered[0]?.code ?? scenarios[0]?.code;

  return (
    <Tabs defaultValue={defaultCode} className="space-y-3">
      <TabsList className="grid w-full grid-cols-3">
        {scenarios.map((s) => (
          <TabsTrigger key={s.code} value={s.code} className="text-xs">
            {s.code.replace(/_/g, " ")}
          </TabsTrigger>
        ))}
      </TabsList>
      {scenarios.map((s) => (
        <TabsContent key={s.code} value={s.code} className="space-y-4">
          <ScenarioBody scenario={s} portfolioValue={portfolioValue} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function ScenarioBody({
  scenario,
  portfolioValue,
}: {
  scenario: StressTestScenario;
  portfolioValue: number;
}) {
  const lossClass = scenario.loss_inr < 0 ? "text-destructive" : "text-muted-foreground";

  return (
    <>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{scenario.label}</h3>
        <p className="text-xs text-muted-foreground">{scenario.window}</p>
        <p className="text-xs text-muted-foreground">{scenario.description}</p>
      </div>

      <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
        <div className="text-xs text-muted-foreground">If this happened today:</div>
        <div className={`text-2xl font-semibold tabular-nums ${lossClass}`}>
          {formatCurrency(scenario.loss_inr, { showSign: true, maximumFractionDigits: 0 })}
          <span className="ml-2 text-sm font-normal">
            ({scenario.loss_pct.toFixed(1)}%)
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          {formatCurrency(portfolioValue, { maximumFractionDigits: 0 })} →{" "}
          {formatCurrency(scenario.portfolio_value_post, { maximumFractionDigits: 0 })}
        </div>
      </div>

      {scenario.top3_losers.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Worst-hit holdings</div>
          <ul className="space-y-1.5">
            {scenario.top3_losers.map((l) => (
              <li
                key={l.symbol}
                className="flex items-center justify-between rounded border px-3 py-2 text-sm"
              >
                <span className="font-medium">{l.symbol}</span>
                <span className="flex flex-col items-end leading-tight">
                  <span className="tabular-nums text-destructive font-medium">
                    {formatCurrency(l.loss_inr, { showSign: true, maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {l.loss_pct.toFixed(1)}%
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

export default StressTestPanel;
