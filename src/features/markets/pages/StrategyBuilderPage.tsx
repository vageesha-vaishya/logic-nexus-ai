/**
 * StrategyBuilderPage — route: /dashboard/markets/strategy-builder
 *
 * Hosts the multi-leg option strategy builder with payoff diagram.
 * Lets users choose an underlying (NIFTY / BANKNIFTY / FINNIFTY) and expiry,
 * then delegates all strategy logic to StrategyBuilder.
 */

import { useState, useEffect } from "react";
import { GitBranch } from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Card,
  CardContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";

import { useFnoUnderlyings, useOptionChain } from "../hooks/useFno";
import { useLTP } from "../hooks/useLTP";
import { StrategyBuilder } from "../components/StrategyBuilder";
import { PlanGate } from "@/components/system/PlanGate";

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtSpot = (v: number | null | undefined): string => {
  if (v == null) return "—";
  return `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StrategyBuilderPage() {
  const [selectedSymbol, setSelectedSymbol] = useState("NIFTY");
  const [selectedExpiry, setSelectedExpiry] = useState("");

  // Load underlyings for the selector
  const underlyings = useFnoUnderlyings();

  // Load option chain for the selected symbol + expiry (to get expiry list)
  const chain = useOptionChain(selectedSymbol, selectedExpiry);

  // Get live spot price via LTP
  const ltpQuery = useLTP([selectedSymbol], "NSE");
  const spotFromLtp = ltpQuery.data?.[selectedSymbol]?.ltp ?? null;

  // Prefer option chain spot (more reliable for indices), fallback to LTP
  const spot = chain.data?.spot ?? spotFromLtp ?? 0;

  // Auto-select first expiry when chain loads
  useEffect(() => {
    if (chain.data?.expiries?.length && !selectedExpiry) {
      setSelectedExpiry(chain.data.expiries[0]);
    }
  }, [chain.data?.expiries, selectedExpiry]);

  // Reset expiry when symbol changes
  useEffect(() => {
    setSelectedExpiry("");
  }, [selectedSymbol]);

  const expiries = chain.data?.expiries ?? [];

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1600px] space-y-4 p-4 lg:p-6">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <GitBranch className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              Options Strategy Builder
            </h1>
            <p className="text-sm text-muted-foreground">
              Build multi-leg strategies · payoff diagram · breakevens · Greeks
            </p>
          </div>
        </header>

        {/* ── Control bar ─────────────────────────────────────────────── */}
        <Card>
          <CardContent className="p-3">
            <div className="flex flex-wrap items-center gap-3">

              {/* Underlying */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground shrink-0">Underlying</span>
                <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Select underlying" />
                  </SelectTrigger>
                  <SelectContent>
                    {underlyings.isLoading && (
                      <SelectItem value="__loading__" disabled>Loading…</SelectItem>
                    )}
                    {(underlyings.data ?? []).map(u => (
                      <SelectItem key={u.symbol} value={u.symbol}>
                        {u.name} ({u.symbol})
                      </SelectItem>
                    ))}
                    {/* Fallback when worker is not available */}
                    {!underlyings.isLoading && (underlyings.data ?? []).length === 0 && (
                      <>
                        <SelectItem value="NIFTY">NIFTY 50</SelectItem>
                        <SelectItem value="BANKNIFTY">BANKNIFTY</SelectItem>
                        <SelectItem value="FINNIFTY">FINNIFTY</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Expiry */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground shrink-0">Expiry</span>
                <Select
                  value={selectedExpiry}
                  onValueChange={setSelectedExpiry}
                  disabled={expiries.length === 0}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder={chain.isLoading ? "Loading…" : "Select expiry"} />
                  </SelectTrigger>
                  <SelectContent>
                    {expiries.map(e => (
                      <SelectItem key={e} value={e}>{e}</SelectItem>
                    ))}
                    {!chain.isLoading && expiries.length === 0 && (
                      <SelectItem value="__none__" disabled>No data</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Spot */}
              <div className="ml-auto flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Spot</span>
                <span className="text-sm font-semibold tabular-nums">{fmtSpot(spot || null)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Strategy Builder ─────────────────────────────────────────── */}
        <PlanGate feature="fno_access" mode="overlay">
          <StrategyBuilder
            underlying={selectedSymbol}
            spot={spot}
            expiry={selectedExpiry}
          />
        </PlanGate>
      </div>
    </DashboardLayout>
  );
}
