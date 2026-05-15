/**
 * Markets — portfolio detail page with AI Brief generator.
 *
 * Route: /dashboard/markets/portfolios/:id
 *
 * Demonstrates the headline markets feature end-to-end:
 *   React → useGenerateBrief mutation
 *        → supabase.functions.invoke('markets-portfolio-brief')
 *        → Edge Function: requireAuth → checkDomainAccess('markets')
 *                       → load portfolio + holdings + last-7d news
 *                       → callLLM('markets.daily_brief', ...)
 *                       → insert markets.briefs (RLS-owned)
 *        → returns brief → react-query cache → render Markdown
 *
 * Per ADR-026 §2: only design-system primitives.
 */

import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  Brain,
  Newspaper,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { usePortfolio, usePortfolioHoldings } from "../hooks/usePortfolio";
import { useBriefs, useGenerateBrief } from "../hooks/useBriefs";
import { NewsPanel } from "../components/NewsPanel";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import {
  Numeric,
  Sparkline,
  EmptyState,
  ErrorState,
  SkeletonCard,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/design-system";
import type { Brief, BriefSource, HoldingWithPrice } from "../types";

export default function PortfolioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const portfolio = usePortfolio(id);
  const holdings = usePortfolioHoldings(id);
  const briefs = useBriefs(id);
  const generateBrief = useGenerateBrief(id);

  const latestBrief = briefs.data?.[0];
  const previousBriefs = briefs.data?.slice(1) ?? [];

  const placeholderSeries = useMemo(() => {
    // Visual-only series; will come from markets.price_history in T2.
    const len = 30;
    const seed = id ? id.charCodeAt(0) : 7;
    return Array.from({ length: len }).map((_, i) => {
      const t = i / (len - 1);
      return 100 + Math.sin((seed + i) * 0.7) * 5 + t * 6;
    });
  }, [id]);

  if (portfolio.isPending) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <SkeletonCard withHeader lines={5} />
      </div>
    );
  }

  if (portfolio.isError) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <ErrorState
          title="Failed to load portfolio"
          message={portfolio.error?.message ?? "Unknown error"}
          onRetry={() => portfolio.refetch()}
        />
      </div>
    );
  }

  if (!portfolio.data) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <EmptyState
          title="Portfolio not found"
          description="The portfolio you're looking for doesn't exist, or you don't have access to it."
          actionLabel="Back to portfolios"
          onAction={() => {
            window.location.href = "/dashboard/markets/portfolios";
          }}
        />
      </div>
    );
  }

  const p = portfolio.data;

  const onGenerate = async () => {
    try {
      await generateBrief.mutateAsync();
      toast.success("Brief generated");
    } catch (e: any) {
      toast.error(`Could not generate brief: ${e?.message ?? "Unknown error"}`);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* ─── Back nav ─────────────────────────────────────────────── */}
      <div>
        <Link
          to="/dashboard/markets/portfolios"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" aria-hidden="true" />
          All portfolios
        </Link>
      </div>

      {/* ─── Portfolio header + KPI strip ─────────────────────────── */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{p.name}</h1>
            <Badge variant={p.mode === "live" ? "default" : "secondary"} className="capitalize">
              {p.mode}
            </Badge>
          </div>
          {p.description && (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{p.description}</p>
          )}
        </div>
        <Button
          onClick={onGenerate}
          disabled={generateBrief.isPending}
          size="lg"
        >
          <Brain className="mr-2 h-4 w-4" aria-hidden="true" />
          {generateBrief.isPending ? "Generating brief…" : "Generate AI brief"}
        </Button>
      </header>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-5 md:grid-cols-4">
          <KpiCell label="NAV">
            <Numeric
              value={holdings.data?.nav ?? 0}
              format="currency"
              currency={p.base_currency}
              className="text-2xl font-semibold"
            />
          </KpiCell>
          <KpiCell label="Today">
            <Numeric
              value={holdings.data?.todayPnl ?? 0}
              format="pnl"
              currency={p.base_currency}
              colorBySign
              withArrow
              className="text-xl font-semibold"
            />
          </KpiCell>
          <KpiCell label="Since inception">
            <Numeric
              value={holdings.data?.sinceInceptionPct ?? 0}
              format="percent"
              colorBySign
              withArrow
              className="text-xl font-semibold"
            />
          </KpiCell>
          <KpiCell label="30-day trend">
            <Sparkline series={placeholderSeries} width={120} height={36} />
          </KpiCell>
        </CardContent>
      </Card>

      {/* ─── Holdings table ───────────────────────────────────────────── */}
      {(holdings.data?.holdings.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Holdings</CardTitle>
          </CardHeader>
          <CardContent>
            <HoldingsTable
              holdings={holdings.data!.holdings}
              currency={p.base_currency}
            />
          </CardContent>
        </Card>
      )}

      {/* ─── Two columns: brief + news ────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          {/* Brief generation surface */}
          {generateBrief.isError && (
            <ErrorState
              title="Brief generation failed"
              message={generateBrief.error?.message ?? "Unknown error"}
              code={(generateBrief.error as any)?.code}
              onRetry={onGenerate}
              learnMoreUrl={
                (generateBrief.error as any)?.code === "missing_api_key"
                  ? "https://supabase.com/docs/guides/functions/secrets"
                  : undefined
              }
            />
          )}

          {briefs.isPending && <SkeletonCard withHeader lines={5} />}

          {briefs.isSuccess && !latestBrief && (
            <EmptyState
              icon={<Brain className="h-10 w-10" />}
              title="No briefs yet"
              description="Generate your first AI brief — a Markdown-formatted analysis of this portfolio against the latest market news (last 7 days)."
              actionLabel={generateBrief.isPending ? "Generating…" : "Generate AI brief"}
              onAction={onGenerate}
            />
          )}

          {latestBrief && <BriefCard brief={latestBrief} variant="latest" />}

          {previousBriefs.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                {previousBriefs.length}{" "}
                {previousBriefs.length === 1 ? "earlier brief" : "earlier briefs"}
              </summary>
              <div className="mt-3 space-y-3">
                {previousBriefs.map((b) => (
                  <BriefCard key={b.id} brief={b} variant="compact" />
                ))}
              </div>
            </details>
          )}
        </div>

        <aside className="space-y-6">
          <NewsPanel limit={8} />
        </aside>
      </div>
    </div>
  );
}

// ─── Pieces ────────────────────────────────────────────────────────────

function KpiCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function HoldingsTable({
  holdings,
  currency,
}: {
  holdings: HoldingWithPrice[];
  currency: string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Symbol</TableHead>
          <TableHead className="text-right">Qty</TableHead>
          <TableHead className="text-right">Avg cost</TableHead>
          <TableHead className="text-right">LTP</TableHead>
          <TableHead className="text-right">Value</TableHead>
          <TableHead className="text-right">P&amp;L</TableHead>
          <TableHead className="text-right">P&amp;L %</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {holdings.map((h) => {
          const ltp = h.last_price ?? h.avg_cost;
          const value = h.qty * ltp;
          const pnl = h.qty * (ltp - h.avg_cost);
          const pnlPct = h.avg_cost > 0 ? ((ltp - h.avg_cost) / h.avg_cost) * 100 : 0;
          const sign = pnl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
          return (
            <TableRow key={h.id}>
              <TableCell className="font-mono font-medium">
                <div className="flex items-center gap-2">
                  {h.instrument?.symbol ?? "—"}
                  <Badge variant="secondary" className="text-xs">
                    {h.instrument?.exchange ?? "—"}
                  </Badge>
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">{h.qty}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                <Numeric value={h.avg_cost} format="currency" currency={currency} />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {h.last_price != null
                  ? <Numeric value={h.last_price} format="currency" currency={currency} />
                  : <span className="text-muted-foreground">—</span>}
              </TableCell>
              <TableCell className="text-right tabular-nums font-medium">
                <Numeric value={value} format="currency" currency={currency} />
              </TableCell>
              <TableCell className={`text-right tabular-nums ${sign}`}>
                <Numeric value={pnl} format="pnl" currency={currency} colorBySign />
              </TableCell>
              <TableCell className={`text-right tabular-nums ${sign}`}>
                <Numeric value={pnlPct} format="percent" colorBySign withArrow />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function BriefCard({
  brief,
  variant,
}: {
  brief: Brief;
  variant: "latest" | "compact";
}) {
  const isLatest = variant === "latest";
  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain
              className={
                isLatest
                  ? "h-4 w-4 text-primary"
                  : "h-4 w-4 text-muted-foreground"
              }
              aria-hidden="true"
            />
            {brief.title ?? "AI Brief"}
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(brief.ts)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {formatDateTime(brief.ts)} ·{" "}
          <span className="font-mono">{brief.llm_provider ?? "—"}</span>
          {brief.llm_model && (
            <>
              {" · "}
              <span className="font-mono">{brief.llm_model}</span>
            </>
          )}
          {Number.isFinite(brief.cost_usd ?? NaN) && (brief.cost_usd ?? 0) > 0 && (
            <>
              {" · "}
              <Numeric
                value={brief.cost_usd ?? 0}
                format="currency"
                currency="USD"
                maximumFractionDigits={4}
              />
            </>
          )}
        </p>
      </CardHeader>
      <CardContent className="prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown>{brief.body}</ReactMarkdown>
        {Array.isArray(brief.sources) && brief.sources.length > 0 && (
          <div className="mt-4 border-t pt-3 not-prose">
            <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
              <Newspaper className="h-3 w-3" aria-hidden="true" />
              Sources
            </p>
            <ol className="space-y-1 text-xs">
              {brief.sources.slice(0, 8).map((s, i) => (
                <SourceItem key={i} index={i + 1} source={s} />
              ))}
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SourceItem({ index, source }: { index: number; source: BriefSource }) {
  return (
    <li>
      <span className="mr-1 text-muted-foreground">[{index}]</span>
      {source.url ? (
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer noopener"
          className="text-foreground hover:underline"
        >
          {source.title}
        </a>
      ) : (
        <span>{source.title}</span>
      )}
      <span className="ml-1 text-muted-foreground">
        — {source.source}, {formatRelativeTime(source.ts)}
      </span>
    </li>
  );
}
