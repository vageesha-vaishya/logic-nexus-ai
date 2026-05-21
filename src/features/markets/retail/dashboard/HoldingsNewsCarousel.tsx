/**
 * Holdings-aware market commentary carousel — Phase 1 Addendum T20.
 *
 * Horizontal-scrolling cards on retail Home, one per top-3 holding,
 * showing the last 24h of headlines for each symbol. Raw headlines for
 * v1; LLM-generated 2-3 line summaries layer in once worker keys are
 * unblocked.
 *
 * Quiet-fails (returns null) on 401/5xx so the worker startup window
 * doesn't surface red errors on Home.
 */
import { Newspaper, ExternalLink } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { useHoldingsNews, type HoldingsNewsBucket } from "../hooks/useHoldingsNews";

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const mins = Math.max(0, Math.round((now - then) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export function HoldingsNewsCarousel() {
  const { data, isLoading, isError } = useHoldingsNews();

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Newspaper className="h-3.5 w-3.5" /> News on your holdings
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 snap-x">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-64 shrink-0 snap-start" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) return null;

  // Hide entirely when no top holdings or no news for any of them.
  const hasAnyNews = data.holdings.some((h) => h.news.length > 0);
  if (data.holdings.length === 0 || !hasAnyNews) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Newspaper className="h-3.5 w-3.5" /> News on your holdings · last 24h
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 snap-x">
        {data.holdings.map((h) => (
          <NewsCard key={h.symbol} bucket={h} />
        ))}
      </div>
    </div>
  );
}

function NewsCard({ bucket }: { bucket: HoldingsNewsBucket }) {
  if (bucket.news.length === 0) {
    return (
      <Card className="w-64 shrink-0 snap-start">
        <CardContent className="p-3 space-y-1.5">
          <div className="text-sm font-semibold">{bucket.symbol}</div>
          <p className="text-xs text-muted-foreground">No news in the last 24h.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-64 shrink-0 snap-start">
      <CardContent className="p-3 space-y-2">
        <div className="text-sm font-semibold">{bucket.symbol}</div>
        <ul className="space-y-1.5">
          {bucket.news.slice(0, 3).map((item) => (
            <li key={item.id} className="text-xs leading-snug">
              {item.raw_url ? (
                <a
                  href={item.raw_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-start gap-1 text-foreground hover:underline"
                >
                  <span className="line-clamp-2">{item.title}</span>
                  <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                </a>
              ) : (
                <span className="text-foreground line-clamp-2">{item.title}</span>
              )}
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                {item.source ?? "wire"} · {relativeTime(item.ts)}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default HoldingsNewsCarousel;
