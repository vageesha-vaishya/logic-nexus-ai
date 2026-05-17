/**
 * Markets — instrument detail page.
 *
 * Route: /dashboard/markets/instruments/:id
 *
 * Shows everything we know about a single instrument:
 *   • Metadata (symbol/exchange/ISIN/type, lot/tick if derivative)
 *   • Which of the user's watchlists hold it (with quick "remove" actions)
 *   • Recent news mentioning it (last 30 days), each card with sentiment chip
 *   • 7-day sentiment summary (count + avg)
 *
 * Price chart deferred until quote/price ingestion lands (next milestone).
 */

import { useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ArrowLeft, ExternalLink, Newspaper, Star, Trash2 } from "lucide-react";
import { TradingChart } from "@/features/markets/components/TradingChart";
import { MarketDepthPanel } from "@/features/markets/components/MarketDepthPanel";
import { QuickTradeButton } from "@/features/markets/components/QuickTradeButton";

import {
  useInstrumentDetail,
  useRemoveWatchlistItem,
} from "../hooks/useWatchlists";
import { formatDateTime, formatRelativeTime } from "@/lib/format";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  SkeletonCard,
} from "@/design-system";
import { toast } from "sonner";

export default function InstrumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const detail = useInstrumentDetail(id);

  return (
    <DashboardLayout>
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </button>
      </div>

      {detail.isPending && (
        <div className="space-y-4">
          <SkeletonCard withHeader lines={2} />
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <SkeletonCard lines={6} />
            <SkeletonCard lines={4} />
          </div>
        </div>
      )}

      {detail.isError && (
        <ErrorState
          title="Failed to load instrument"
          message={detail.error?.message ?? "Unknown error"}
          onRetry={() => detail.refetch()}
        />
      )}

      {detail.isSuccess && (
        <>
          <Header data={detail.data} />

          {/* Price Chart */}
          <TradingChart
            symbol={detail.data.instrument.symbol}
            exchange={detail.data.instrument.exchange}
            height={420}
            showVolume
            title={`${detail.data.instrument.symbol} · ${detail.data.instrument.exchange}`}
          />

          {/* Level 2 Market Depth */}
          <MarketDepthPanel
            symbol={detail.data.instrument.symbol}
            exchange={detail.data.instrument.exchange}
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
            <div className="min-w-0 space-y-6">
              <SentimentCard summary={detail.data.sentiment_summary} />
              <NewsCard news={detail.data.news} />
            </div>
            <aside className="space-y-6">
              <OnWatchlistsCard watchlists={detail.data.on_watchlists} />
            </aside>
          </div>
        </>
      )}
    </div>
    </DashboardLayout>
  );
}

// ─── Header ────────────────────────────────────────────────────────────

function Header({ data }: { data: import("../types").InstrumentDetail }) {
  const i = data.instrument;
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="flex items-center gap-3 font-mono text-2xl font-semibold tracking-tight">
          {i.symbol}
          <Badge variant="secondary">{i.exchange}</Badge>
          <QuickTradeButton symbol={i.symbol} exchange={i.exchange} size="default" />
          {!i.is_active && (
            <Badge variant="outline" className="text-xs">
              inactive
            </Badge>
          )}
        </h1>
        <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-muted-foreground">
          <span className="capitalize">{i.instrument_type}</span>
          {i.isin && (
            <span>
              ISIN: <span className="font-mono">{i.isin}</span>
            </span>
          )}
          {i.lot_size != null && <span>Lot: {i.lot_size}</span>}
          {i.tick_size != null && <span>Tick: {i.tick_size}</span>}
          {i.expiry && <span>Expiry: {i.expiry}</span>}
          {i.strike != null && <span>Strike: {i.strike}</span>}
        </p>
      </div>
    </header>
  );
}

// ─── Sentiment summary ─────────────────────────────────────────────────

function SentimentCard({
  summary,
}: {
  summary: import("../types").InstrumentDetail["sentiment_summary"];
}) {
  const { count_7d, count_scored_7d, avg_score_7d, count_30d } = summary;
  const sentimentLabel =
    avg_score_7d == null
      ? "—"
      : avg_score_7d > 0.2
        ? "Positive"
        : avg_score_7d < -0.2
          ? "Negative"
          : "Neutral";
  const sentimentTone =
    avg_score_7d == null
      ? "text-muted-foreground"
      : avg_score_7d > 0.2
        ? "text-emerald-600"
        : avg_score_7d < -0.2
          ? "text-rose-600"
          : "text-amber-600";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sentiment (last 7 days)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">7-day articles</p>
            <p className="mt-1 text-xl font-semibold">{count_7d}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Avg sentiment</p>
            <p className={`mt-1 text-xl font-semibold ${sentimentTone}`}>
              {avg_score_7d == null ? "—" : avg_score_7d.toFixed(2)}
              <span className="ml-1 text-sm font-normal">{sentimentLabel}</span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {count_scored_7d} scored / {count_7d} total
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">30-day articles</p>
            <p className="mt-1 text-xl font-semibold">{count_30d}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── News list ─────────────────────────────────────────────────────────

function NewsCard({
  news,
}: {
  news: import("../types").InstrumentDetail["news"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Newspaper className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Recent news (last 30 days)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {news.length === 0 ? (
          <EmptyState
            icon={<Newspaper className="h-10 w-10" />}
            title="No news yet"
            description="No news events have mentioned this instrument in the last 30 days. New articles will appear here as they're ingested."
          />
        ) : (
          <ul className="space-y-3">
            {news.map((n) => (
              <li key={n.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium">
                      {n.raw_url ? (
                        <a
                          href={n.raw_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {n.title}
                          <ExternalLink className="ml-1 inline h-3 w-3 align-baseline" aria-hidden="true" />
                        </a>
                      ) : (
                        n.title
                      )}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{n.source}</span>
                      <span>·</span>
                      <span title={formatDateTime(n.ts)}>{formatRelativeTime(n.ts)}</span>
                    </p>
                  </div>
                  {typeof n.sentiment_score === "number" && (
                    <SentimentChip score={n.sentiment_score} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function SentimentChip({ score }: { score: number }) {
  const tone =
    score > 0.2
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
      : score < -0.2
        ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
        : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300";
  return (
    <span className={`shrink-0 rounded px-2 py-0.5 font-mono text-xs ${tone}`}>
      {score >= 0 ? "+" : ""}
      {score.toFixed(2)}
    </span>
  );
}

// ─── On-watchlists side card ──────────────────────────────────────────

function OnWatchlistsCard({
  watchlists,
}: {
  watchlists: import("../types").InstrumentDetail["on_watchlists"];
}) {
  if (watchlists.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">On your watchlists</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This instrument isn't on any of your watchlists yet.
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">On your watchlists</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {watchlists.map((w) => (
            <WatchlistRow key={w.item_id} entry={w} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function WatchlistRow({
  entry,
}: {
  entry: import("../types").InstrumentDetail["on_watchlists"][number];
}) {
  const remove = useRemoveWatchlistItem(entry.watchlist_id);
  const onRemove = async () => {
    if (!confirm(`Remove from "${entry.watchlist_name}"?`)) return;
    try {
      await remove.mutateAsync(entry.item_id);
      toast.success(`Removed from "${entry.watchlist_name}"`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not remove");
    }
  };
  return (
    <li className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
      <span className="flex min-w-0 items-center gap-2 truncate">
        {entry.is_default && (
          <Star className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
        )}
        <span className="truncate">{entry.watchlist_name}</span>
      </span>
      <Button
        size="sm"
        variant="ghost"
        onClick={onRemove}
        disabled={remove.isPending}
        className="text-destructive hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="sr-only">Remove from {entry.watchlist_name}</span>
      </Button>
    </li>
  );
}
