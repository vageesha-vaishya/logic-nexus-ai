/**
 * OptionChainTable — NSE-style option chain layout.
 *
 * Layout: CALLS (left) | STRIKE (centre) | PUTS (right)
 * Supports greek columns toggle, OI visualisation bars, ATM auto-scroll,
 * and Buy/Sell quick-action buttons on each strike.
 */

import { useEffect, useRef } from "react";
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/design-system";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { OptionChain, OptionLeg, OptionStrike } from "../hooks/useFno";

// ── Props ─────────────────────────────────────────────────────────────────────

interface OptionChainTableProps {
  chain:       OptionChain;
  onBuy?:      (strike: number, type: "CE" | "PE") => void;
  onSell?:     (strike: number, type: "CE" | "PE") => void;
  showGreeks?: boolean; // default false
}

// ── Number formatters ─────────────────────────────────────────────────────────

const fmtINR = (v: number | null): string =>
  v == null
    ? "—"
    : `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtOI = (v: number | null): string => {
  if (v == null) return "—";
  if (v >= 1_00_000) return `${(v / 1_00_000).toFixed(2)}L`;
  if (v >= 1_000)    return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
};

const fmtOIChg = (v: number | null): string => {
  if (v == null) return "—";
  const s = fmtOI(Math.abs(v));
  return v >= 0 ? `+${s}` : `-${s}`;
};

const fmtIV  = (v: number | null): string => (v == null ? "—" : `${v.toFixed(2)}%`);
const fmtGrk = (v: number | null): string => (v == null ? "—" : v.toFixed(4));

// ── OI cell with bar ──────────────────────────────────────────────────────────

function OICell({
  oi,
  maxOi,
  side,
  align = "right",
}: {
  oi: number | null;
  maxOi: number;
  side: "ce" | "pe";
  align?: "left" | "right";
}) {
  const pct = oi != null && maxOi > 0 ? Math.round((oi / maxOi) * 100) : 0;
  const barCls =
    side === "ce" ? "bg-blue-200 dark:bg-blue-800" : "bg-rose-200 dark:bg-rose-800";
  return (
    <TableCell className={align === "right" ? "text-right pr-2" : "text-left pl-2"}>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs tabular-nums">{fmtOI(oi)}</span>
        <div
          className={`h-1 rounded-full ${barCls}`}
          style={{ width: `${pct}%`, minWidth: pct > 0 ? "2px" : "0" }}
        />
      </div>
    </TableCell>
  );
}

// ── OI Change cell ────────────────────────────────────────────────────────────

function OIChgCell({
  value,
  align = "right",
}: {
  value: number | null;
  align?: "left" | "right";
}) {
  const colorCls =
    (value ?? 0) >= 0
      ? "text-green-600 dark:text-green-400"
      : "text-red-600 dark:text-red-400";
  return (
    <TableCell className={`text-xs tabular-nums ${colorCls} ${align === "right" ? "text-right" : "text-left"}`}>
      {fmtOIChg(value)}
    </TableCell>
  );
}

// ── Buy / Sell button pair ────────────────────────────────────────────────────

function BSCell({
  strike,
  type,
  onBuy,
  onSell,
  align = "left",
}: {
  strike: number;
  type: "CE" | "PE";
  onBuy?: (strike: number, type: "CE" | "PE") => void;
  onSell?: (strike: number, type: "CE" | "PE") => void;
  align?: "left" | "right";
}) {
  return (
    <TableCell className={align === "right" ? "pl-1 pr-0" : "pr-1 pl-0"}>
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-1.5 text-[10px] text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
          onClick={() => onBuy?.(strike, type)}
        >
          B
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-1.5 text-[10px] text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
          onClick={() => onSell?.(strike, type)}
        >
          S
        </Button>
      </div>
    </TableCell>
  );
}

// ── Row renderer ─────────────────────────────────────────────────────────────

interface StrikeRowProps {
  strike:     OptionStrike;
  maxCeOi:    number;
  maxPeOi:    number;
  showGreeks: boolean;
  isAtm:      boolean;
  atmRef:     React.Ref<HTMLTableRowElement>;
  onBuy?:     (strike: number, type: "CE" | "PE") => void;
  onSell?:    (strike: number, type: "CE" | "PE") => void;
}

function StrikeRow({
  strike,
  maxCeOi,
  maxPeOi,
  showGreeks,
  isAtm,
  atmRef,
  onBuy,
  onSell,
}: StrikeRowProps) {
  const ce = strike.ce;
  const pe = strike.pe;
  const rowCls = isAtm ? "bg-yellow-50 dark:bg-yellow-900/30 font-semibold" : "";
  const callBg = strike.itm_call ? "bg-blue-50 dark:bg-blue-950/30" : "";
  const putBg  = strike.itm_put  ? "bg-rose-50 dark:bg-rose-950/30"  : "";

  return (
    <TableRow ref={isAtm ? atmRef : undefined} className={rowCls}>
      {/* ── CALLS ─────────────────────────────────────────────────── */}
      {/* OI */}
      <OICell oi={ce?.oi ?? null} maxOi={maxCeOi} side="ce" align="right" />

      {/* ΔOI */}
      <OIChgCell value={ce?.oi_change ?? null} align="right" />

      {/* Volume */}
      <TableCell className="text-right text-xs tabular-nums">
        {fmtOI(ce?.volume ?? null)}
      </TableCell>

      {/* IV */}
      <TableCell className={`text-right text-xs tabular-nums ${callBg}`}>
        {fmtIV(ce?.iv ?? null)}
      </TableCell>

      {/* Greeks (conditional) */}
      {showGreeks && (
        <>
          <TableCell className={`text-right text-xs tabular-nums ${callBg}`}>
            {fmtGrk(ce?.delta ?? null)}
          </TableCell>
          <TableCell className={`text-right text-xs tabular-nums ${callBg}`}>
            {fmtGrk(ce?.theta ?? null)}
          </TableCell>
        </>
      )}

      {/* LTP */}
      <TableCell className={`text-right font-medium text-xs tabular-nums ${callBg}`}>
        {fmtINR(ce?.ltp ?? null)}
      </TableCell>

      {/* B/S buttons — CALLS */}
      <BSCell strike={strike.strike} type="CE" onBuy={onBuy} onSell={onSell} align="right" />

      {/* ── STRIKE ────────────────────────────────────────────────── */}
      <TableCell
        className={`text-center font-semibold tabular-nums bg-muted/50 text-sm ${
          isAtm ? "ring-2 ring-yellow-400 dark:ring-yellow-500 ring-inset" : ""
        }`}
      >
        {strike.strike.toLocaleString("en-IN")}
      </TableCell>

      {/* ── PUTS ──────────────────────────────────────────────────── */}
      {/* B/S buttons — PUTS */}
      <BSCell strike={strike.strike} type="PE" onBuy={onBuy} onSell={onSell} align="left" />

      {/* LTP */}
      <TableCell className={`text-left font-medium text-xs tabular-nums ${putBg}`}>
        {fmtINR(pe?.ltp ?? null)}
      </TableCell>

      {/* IV */}
      <TableCell className={`text-left text-xs tabular-nums ${putBg}`}>
        {fmtIV(pe?.iv ?? null)}
      </TableCell>

      {/* Greeks (conditional) */}
      {showGreeks && (
        <>
          <TableCell className={`text-left text-xs tabular-nums ${putBg}`}>
            {fmtGrk(pe?.delta ?? null)}
          </TableCell>
          <TableCell className={`text-left text-xs tabular-nums ${putBg}`}>
            {fmtGrk(pe?.theta ?? null)}
          </TableCell>
        </>
      )}

      {/* Volume */}
      <TableCell className="text-left text-xs tabular-nums">
        {fmtOI(pe?.volume ?? null)}
      </TableCell>

      {/* ΔOI */}
      <OIChgCell value={pe?.oi_change ?? null} align="left" />

      {/* OI */}
      <OICell oi={pe?.oi ?? null} maxOi={maxPeOi} side="pe" align="left" />
    </TableRow>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function OptionChainTable({
  chain,
  onBuy,
  onSell,
  showGreeks = false,
}: OptionChainTableProps) {
  const atmRowRef = useRef<HTMLTableRowElement>(null);

  // Auto-scroll ATM row into view when chain or expiry changes
  useEffect(() => {
    if (atmRowRef.current) {
      atmRowRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [chain.symbol, chain.expiry]);

  // Defensive: strikes can come back undefined from a partial response;
  // hoist a stable local so every downstream `.map` works on [] in that case.
  const strikes = Array.isArray(chain?.strikes) ? chain.strikes : [];

  // Pre-compute max OI values for relative bar scaling
  const maxCeOi = Math.max(
    1,
    ...strikes.map(s => s.ce?.oi ?? 0).filter((v): v is number => v > 0),
  );
  const maxPeOi = Math.max(
    1,
    ...strikes.map(s => s.pe?.oi ?? 0).filter((v): v is number => v > 0),
  );

  return (
    <ScrollArea className="h-[calc(100vh-280px)]">
      <Table className="text-xs w-full">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <TableHeader>
          {/* Section label row */}
          <TableRow className="sticky top-0 z-10 bg-background border-b-0">
            {/* CALLS label spanning all call columns */}
            <TableHead
              colSpan={showGreeks ? 8 : 6}
              className="text-center text-blue-600 dark:text-blue-400 font-semibold py-1.5 bg-blue-50/60 dark:bg-blue-950/20"
            >
              CALLS
            </TableHead>
            <TableHead className="text-center font-semibold py-1.5 bg-muted/50 w-24">
              STRIKE
            </TableHead>
            {/* PUTS label spanning all put columns */}
            <TableHead
              colSpan={showGreeks ? 8 : 6}
              className="text-center text-rose-600 dark:text-rose-400 font-semibold py-1.5 bg-rose-50/60 dark:bg-rose-950/20"
            >
              PUTS
            </TableHead>
          </TableRow>

          {/* Column label row */}
          <TableRow className="sticky top-8 z-10 bg-background">
            {/* CALLS */}
            <TableHead className="text-right pr-2 w-20">OI</TableHead>
            <TableHead className="text-right w-16">ΔOI</TableHead>
            <TableHead className="text-right w-16">Vol</TableHead>
            <TableHead className="text-right w-14">IV</TableHead>
            {showGreeks && (
              <>
                <TableHead className="text-right w-14">δ</TableHead>
                <TableHead className="text-right w-14">θ</TableHead>
              </>
            )}
            <TableHead className="text-right w-20">LTP</TableHead>
            <TableHead className="w-14" />

            {/* Strike */}
            <TableHead className="text-center bg-muted/50 w-24">Strike</TableHead>

            {/* PUTS */}
            <TableHead className="w-14" />
            <TableHead className="text-left w-20">LTP</TableHead>
            <TableHead className="text-left w-14">IV</TableHead>
            {showGreeks && (
              <>
                <TableHead className="text-left w-14">δ</TableHead>
                <TableHead className="text-left w-14">θ</TableHead>
              </>
            )}
            <TableHead className="text-left w-16">Vol</TableHead>
            <TableHead className="text-left w-16">ΔOI</TableHead>
            <TableHead className="text-left pl-2 w-20">OI</TableHead>
          </TableRow>
        </TableHeader>

        {/* ── Body ───────────────────────────────────────────────────── */}
        <TableBody>
          {strikes.map((strike) => (
            <StrikeRow
              key={strike.strike}
              strike={strike}
              maxCeOi={maxCeOi}
              maxPeOi={maxPeOi}
              showGreeks={showGreeks}
              isAtm={strike.is_atm}
              atmRef={atmRowRef}
              onBuy={onBuy}
              onSell={onSell}
            />
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
