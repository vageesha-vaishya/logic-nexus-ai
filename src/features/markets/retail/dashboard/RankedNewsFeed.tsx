/**
 * RankedNewsFeed — Phase 1 addendum T20.
 *
 * Sits below the existing HoldingsNewsCarousel on retail Home and gives
 * users a single vertical list of news prioritized by relevance, not just
 * freshness. Sourcing + bucketing is unchanged (worker still returns the
 * payload bucketed per top-3 holding); ranking is purely client-side via
 * `rankHoldingsNews` so the heuristic stays editable.
 *
 * Why a feed alongside the carousel: the carousel is the "what's
 * happening to *each* of my holdings" view, the feed is the "what's the
 * single most important thing right now" view. They answer different
 * questions; we kept both rather than killing the carousel and breaking
 * the existing first-Home tour anchor.
 */
import { ExternalLink, Newspaper } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { useHoldingsNews } from "../hooks/useHoldingsNews";
import { rankHoldingsNews, reasonLabel, type RankedNewsItem } from "../lib/news-scoring";

const MAX_ITEMS = 8;

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now  = Date.now();
  const mins = Math.max(0, Math.round((now - then) / 60_000));
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs  = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

function chipVariant(reason: RankedNewsItem["reason"]): "default" | "destructive" | "secondary" | "outline" {
  switch (reason) {
    case "bearish":     return "destructive";
    case "bullish":     return "default";
    case "top_holding": return "secondary";
    default:            return "outline";
  }
}

export function RankedNewsFeed() {
  const { data, isLoading, isError } = useHoldingsNews();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-base">
            <Newspaper className="h-4 w-4" /> For your portfolio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) return null;

  const ranked = rankHoldingsNews(data).slice(0, MAX_ITEMS);
  if (ranked.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1.5 text-base">
          <Newspaper className="h-4 w-4" /> For your portfolio
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {ranked.map((r) => (
            <li key={r.news.id} className="flex items-start gap-2 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant={chipVariant(r.reason)} className="px-1.5 py-0 text-[10px] font-medium leading-tight">
                    {reasonLabel(r.reason)}
                  </Badge>
                  {r.symbol && (
                    <span className="text-xs font-semibold">{r.symbol}</span>
                  )}
                  {r.portfolioWeight >= 0.05 && (
                    <span className="text-[10px] text-muted-foreground">
                      · {(r.portfolioWeight * 100).toFixed(0)}% of portfolio
                    </span>
                  )}
                </div>
                <div className="text-sm leading-snug">
                  {r.news.raw_url ? (
                    <a
                      href={r.news.raw_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-start gap-1 text-foreground hover:underline"
                    >
                      <span className="line-clamp-2">{r.news.title}</span>
                      <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                    </a>
                  ) : (
                    <span className="text-foreground line-clamp-2">{r.news.title}</span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {r.news.source ?? "wire"} · {relativeTime(r.news.ts)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default RankedNewsFeed;
