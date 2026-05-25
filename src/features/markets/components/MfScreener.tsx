/**
 * MfScreener — multi-filter mutual fund screener.
 *
 * Self-contained. Fetches all funds via useMfFunds("", "ALL") and applies
 * client-side filters + sort in a useMemo.
 */

import { useMemo, useState } from "react";
import { Filter, PiggyBank, Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/design-system";
import { useMfFunds, type MfFund } from "../hooks/useMf";
import { MfOrderSheet } from "./MfOrderSheet";
import { useBrokerConnections } from "../hooks/useBrokerConnections";
import { RiskPill, type RiskLevel } from "@/components/risk-pill";

// ── Types ────────────────────────────────────────────────────────────────────

type SortKey = "1y" | "3y" | "5y" | "aum" | "expense";

interface EnrichedFund extends MfFund {
  return_1y?: number | null;
  return_3y?: number | null;
  return_5y?: number | null;
  aum?: number | null;
  expense_ratio?: number | null;
  rating?: number | null;
  category?: string | null;
  amc?: string | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  { value: "Equity",    label: "Equity" },
  { value: "Debt",      label: "Debt" },
  { value: "Hybrid",    label: "Hybrid" },
  { value: "ELSS",      label: "ELSS" },
  { value: "Liquid",    label: "Liquid" },
  { value: "Index",     label: "Index" },
  { value: "FoF",       label: "FoF" },
  { value: "Overnight", label: "Overnight" },
  { value: "Arbitrage", label: "Arbitrage" },
];

const RETURN_1Y_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Any",  value: null },
  { label: ">10%", value: 10 },
  { label: ">15%", value: 15 },
  { label: ">20%", value: 20 },
  { label: ">25%", value: 25 },
  { label: ">30%", value: 30 },
];

const RETURN_3Y_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Any",  value: null },
  { label: ">8%",  value: 8 },
  { label: ">12%", value: 12 },
  { label: ">15%", value: 15 },
  { label: ">20%", value: 20 },
];

const EXPENSE_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Any",    value: null },
  { label: "<0.5%",  value: 0.5 },
  { label: "<1%",    value: 1 },
  { label: "<1.5%",  value: 1.5 },
];

const AUM_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Any",       value: null },
  { label: ">100 Cr",   value: 100 },
  { label: ">500 Cr",   value: 500 },
  { label: ">1000 Cr",  value: 1000 },
  { label: ">5000 Cr",  value: 5000 },
];

const SORT_OPTIONS: { label: string; value: SortKey }[] = [
  { label: "1Y Return",      value: "1y" },
  { label: "3Y Return",      value: "3y" },
  { label: "5Y Return",      value: "5y" },
  { label: "AUM",            value: "aum" },
  { label: "Expense Ratio",  value: "expense" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Heuristic risk mapping from category + raw scheme text. Aligned with the
 * "typical examples" table on /methodology/volatility. When real per-fund
 * annualised-volatility data becomes available on MfFund, swap this for a
 * threshold-based computation against the methodology's < 10% / 10–20% / > 20%
 * buckets.
 */
function deriveRisk(fund: MfFund, category: string | null): RiskLevel | null {
  if (!category) return null;
  const raw = (fund.scheme_category ?? fund.instrument_type ?? "").toLowerCase();

  // High-volatility equity sub-categories — keyword sweep on the raw scheme text.
  if (
    raw.includes("small cap") || raw.includes("smallcap") ||
    raw.includes("mid cap") || raw.includes("midcap") ||
    raw.includes("sector") || raw.includes("thematic")
  ) {
    return "high";
  }

  switch (category) {
    case "Liquid":
    case "Overnight":
      return "low";
    case "Arbitrage":
      return "low";
    case "Debt":
      // Long-duration / credit-risk funds swing more than short/liquid debt.
      return raw.includes("long") || raw.includes("credit") || raw.includes("dynamic")
        ? "medium"
        : "low";
    case "Hybrid":
    case "FoF":
    case "Index":
    case "ELSS":
    case "Equity":
      return "medium";
    default:
      return null;
  }
}

function deriveCategory(fund: MfFund): string | null {
  const raw = fund.scheme_category ?? fund.instrument_type ?? "";
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.includes("elss") || lower.includes("tax")) return "ELSS";
  if (lower.includes("liquid")) return "Liquid";
  if (lower.includes("overnight")) return "Overnight";
  if (lower.includes("arbitrage")) return "Arbitrage";
  if (lower.includes("index") || lower.includes("etf")) return "Index";
  if (lower.includes("fof") || lower.includes("fund of fund")) return "FoF";
  if (lower.includes("hybrid") || lower.includes("balanced")) return "Hybrid";
  if (lower.includes("debt") || lower.includes("bond") || lower.includes("credit") || lower.includes("gilt") || lower.includes("mf_debt")) return "Debt";
  if (lower.includes("equity") || lower.includes("mf_equity")) return "Equity";
  if (lower.includes("mf_index")) return "Index";
  return null;
}

function enrichFund(fund: MfFund): EnrichedFund {
  const meta = (fund as unknown as Record<string, unknown>);
  const returns = (meta.returns as Record<string, number | null> | undefined);
  return {
    ...fund,
    return_1y:     returns?.["1y"]  ?? null,
    return_3y:     returns?.["3y"]  ?? null,
    return_5y:     returns?.["5y"]  ?? null,
    aum:           (meta.aum as number | null) ?? null,
    expense_ratio: (meta.expense_ratio as number | null) ?? null,
    rating:        (meta.rating as number | null) ?? null,
    category:      deriveCategory(fund),
    amc:           fund.fund_house ?? (meta.amc as string | null) ?? null,
  };
}

const fmtPct = (v: number | null | undefined): string => {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
};

const fmtCr = (v: number | null | undefined): string => {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(v) + " Cr";
};

function returnColor(v: number | null | undefined): string {
  if (v == null) return "";
  if (v >= 15) return "text-green-600 dark:text-green-400 font-medium";
  if (v >= 8)  return "text-amber-600 dark:text-amber-400 font-medium";
  return "text-red-600 dark:text-red-400 font-medium";
}

function StarRating({ rating }: { rating: number | null }) {
  if (rating == null) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3 w-3 ${i < rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
        />
      ))}
    </span>
  );
}

function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null;
  const colorMap: Record<string, string> = {
    Equity:    "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200",
    Debt:      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200",
    Hybrid:    "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200",
    ELSS:      "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-200",
    Liquid:    "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300 border-cyan-200",
    Index:     "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 border-teal-200",
    FoF:       "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200",
    Overnight: "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300 border-slate-200",
    Arbitrage: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300 border-violet-200",
  };
  return (
    <Badge variant="outline" className={`text-xs ${colorMap[category] ?? ""}`}>
      {category}
    </Badge>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function MfScreener() {
  // ── Filters state ─────────────────────────────────────────────────────────
  const [categories,   setCategories]   = useState<Set<string>>(new Set());
  const [amcSearch,    setAmcSearch]    = useState("");
  const [minReturn1Y,  setMinReturn1Y]  = useState<number | null>(null);
  const [minReturn3Y,  setMinReturn3Y]  = useState<number | null>(null);
  const [maxExpense,   setMaxExpense]   = useState<number | null>(null);
  const [minAum,       setMinAum]       = useState<number | null>(null);
  const [sortBy,       setSortBy]       = useState<SortKey>("1y");

  // ── Order sheet ───────────────────────────────────────────────────────────
  const [orderSheet, setOrderSheet] = useState<{
    open: boolean;
    fund: MfFund | null;
  }>({ open: false, fund: null });

  // ── Data ──────────────────────────────────────────────────────────────────
  const funds      = useMfFunds("", "");
  const connections = useBrokerConnections();
  const tradeConnection = connections.data?.find(c => c.can_trade) ?? null;

  // ── Filtered + sorted ─────────────────────────────────────────────────────
  const allEnriched = useMemo<EnrichedFund[]>(
    () => (funds.data ?? []).map(enrichFund),
    [funds.data],
  );

  const filtered = useMemo<EnrichedFund[]>(() => {
    const result = allEnriched.filter(fund => {
      if (categories.size > 0 && !categories.has(fund.category ?? "")) return false;
      if (amcSearch && !fund.amc?.toLowerCase().includes(amcSearch.toLowerCase())) return false;
      if (minReturn1Y !== null && (fund.return_1y ?? 0) < minReturn1Y) return false;
      if (minReturn3Y !== null && (fund.return_3y ?? 0) < minReturn3Y) return false;
      if (maxExpense  !== null && (fund.expense_ratio ?? Infinity) > maxExpense) return false;
      if (minAum      !== null && (fund.aum ?? 0) < minAum) return false;
      return true;
    });

    result.sort((a, b) => {
      switch (sortBy) {
        case "1y":      return (b.return_1y     ?? -Infinity) - (a.return_1y     ?? -Infinity);
        case "3y":      return (b.return_3y     ?? -Infinity) - (a.return_3y     ?? -Infinity);
        case "5y":      return (b.return_5y     ?? -Infinity) - (a.return_5y     ?? -Infinity);
        case "aum":     return (b.aum           ?? -Infinity) - (a.aum           ?? -Infinity);
        case "expense": return (a.expense_ratio ?? Infinity)  - (b.expense_ratio ?? Infinity);
        default: return 0;
      }
    });

    return result;
  }, [allEnriched, categories, amcSearch, minReturn1Y, minReturn3Y, maxExpense, minAum, sortBy]);

  // ── Category toggle ───────────────────────────────────────────────────────
  function toggleCategory(value: string) {
    setCategories(prev => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  }

  function clearFilters() {
    setCategories(new Set());
    setAmcSearch("");
    setMinReturn1Y(null);
    setMinReturn3Y(null);
    setMaxExpense(null);
    setMinAum(null);
    setSortBy("1y");
  }

  const hasFilters =
    categories.size > 0 ||
    amcSearch !== "" ||
    minReturn1Y !== null ||
    minReturn3Y !== null ||
    maxExpense  !== null ||
    minAum      !== null;

  const totalCount    = allEnriched.length;
  const filteredCount = filtered.length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Filter panel ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            Screener Filters
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-7 text-xs text-muted-foreground"
                onClick={clearFilters}
              >
                Clear all
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Category toggles */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Category</p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleCategory(opt.value)}
                  className={[
                    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer",
                    categories.has(opt.value)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-muted",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Row 2: AMC search + dropdowns */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">

            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">AMC</p>
              <Input
                placeholder="Search AMC…"
                className="h-8 text-xs"
                value={amcSearch}
                onChange={e => setAmcSearch(e.target.value)}
              />
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">1Y Returns</p>
              <Select
                value={minReturn1Y == null ? "__any__" : String(minReturn1Y)}
                onValueChange={v => setMinReturn1Y(v === "__any__" ? null : Number(v))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  {RETURN_1Y_OPTIONS.map(o => (
                    <SelectItem key={o.label} value={o.value == null ? "__any__" : String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">3Y Returns</p>
              <Select
                value={minReturn3Y == null ? "__any__" : String(minReturn3Y)}
                onValueChange={v => setMinReturn3Y(v === "__any__" ? null : Number(v))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  {RETURN_3Y_OPTIONS.map(o => (
                    <SelectItem key={o.label} value={o.value == null ? "__any__" : String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Expense Ratio</p>
              <Select
                value={maxExpense == null ? "__any__" : String(maxExpense)}
                onValueChange={v => setMaxExpense(v === "__any__" ? null : Number(v))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_OPTIONS.map(o => (
                    <SelectItem key={o.label} value={o.value == null ? "__any__" : String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">AUM</p>
              <Select
                value={minAum == null ? "__any__" : String(minAum)}
                onValueChange={v => setMinAum(v === "__any__" ? null : Number(v))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  {AUM_OPTIONS.map(o => (
                    <SelectItem key={o.label} value={o.value == null ? "__any__" : String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

          </div>

        </CardContent>
      </Card>

      {/* ── Results header ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {funds.isSuccess && (
          <p className="text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-semibold text-foreground">
              {new Intl.NumberFormat("en-IN").format(filteredCount)}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-foreground">
              {new Intl.NumberFormat("en-IN").format(totalCount)}
            </span>{" "}
            funds
          </p>
        )}
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">Sort by</p>
          <Select value={sortBy} onValueChange={v => setSortBy(v as SortKey)}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Results table ──────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-0">
          {funds.isLoading && (
            <div className="p-4 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )}

          {funds.isError && (
            <div className="flex items-center justify-center py-16 text-sm text-destructive">
              {funds.error?.message ?? "Failed to load funds. Check the markets worker connection."}
            </div>
          )}

          {funds.isSuccess && filtered.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <PiggyBank className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                No funds match the current filters. Try relaxing a filter.
              </p>
            </div>
          )}

          {funds.isSuccess && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[220px]">Fund</TableHead>
                    <TableHead>AMC</TableHead>
                    <TableHead className="text-right">1Y Ret.</TableHead>
                    <TableHead className="text-right">3Y Ret.</TableHead>
                    <TableHead className="text-right">5Y Ret.</TableHead>
                    <TableHead className="text-right">AUM</TableHead>
                    <TableHead className="text-right">Exp. Ratio</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((fund) => {
                    const name = fund.scheme_name ?? fund.metadata?.scheme_name ?? fund.symbol;
                    const risk = deriveRisk(fund, fund.category ?? null);
                    return (
                      <TableRow key={fund.symbol}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="text-sm font-medium leading-snug max-w-[220px] truncate" title={name}>
                              {name}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <CategoryBadge category={fund.category ?? null} />
                              {risk && <RiskPill risk={risk} size="sm" />}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">
                          {fund.amc ?? "—"}
                        </TableCell>
                        <TableCell className={`text-right tabular-nums ${returnColor(fund.return_1y)}`}>
                          {fmtPct(fund.return_1y)}
                        </TableCell>
                        <TableCell className={`text-right tabular-nums ${returnColor(fund.return_3y)}`}>
                          {fmtPct(fund.return_3y)}
                        </TableCell>
                        <TableCell className={`text-right tabular-nums ${returnColor(fund.return_5y)}`}>
                          {fmtPct(fund.return_5y)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {fmtCr(fund.aum)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {fund.expense_ratio != null ? `${fund.expense_ratio.toFixed(2)}%` : "—"}
                        </TableCell>
                        <TableCell>
                          <StarRating rating={fund.rating ?? null} />
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400"
                            onClick={() => setOrderSheet({ open: true, fund })}
                          >
                            Invest
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Order Sheet ────────────────────────────────────────────────── */}
      <MfOrderSheet
        open={orderSheet.open}
        onOpenChange={v => setOrderSheet(prev => ({ ...prev, open: v }))}
        fund={orderSheet.fund}
        connectionId={tradeConnection?.id ?? ""}
        connectionName={tradeConnection?.display_name ?? "No broker connected"}
        defaultOrderType="PURCHASE"
        holding={null}
      />
    </div>
  );
}
