/**
 * <NewsPanel> — markets news feed component.
 *
 * Reads markets.news_events via useNewsEvents(); renders a list of headlines
 * with relative time, source, tagged instruments, and sentiment as a
 * color-coded badge. Built entirely on ADR-026 primitives.
 *
 * Used in PortfoliosPage today; also a candidate for the AppShell right-rail
 * once that primitive lands.
 */

import { ExternalLink, Newspaper } from "lucide-react";
import { useNewsEvents } from "../hooks/useNewsEvents";
import { formatRelativeTime } from "@/lib/format";
import {
  Numeric,
  EmptyState,
  ErrorState,
  SkeletonCard,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/design-system";
import { cn } from "@/lib/utils";
import type { NewsEvent } from "../types";

interface NewsPanelProps {
  /** Optional NSE/BSE symbol filter — matches against instruments[]. */
  instrument?: string;
  /** Max rows; default 10. */
  limit?: number;
  /** Heading text. */
  title?: string;
  /** Extra className on the outer Card. */
  className?: string;
}

export function NewsPanel({
  instrument,
  limit = 10,
  title = "Latest market news",
  className,
}: NewsPanelProps) {
  const news = useNewsEvents({ instrument, limit });

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Newspaper className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {title}
        </CardTitle>
        {news.isSuccess && news.data.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {news.data.length} {news.data.length === 1 ? "item" : "items"}
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {news.isPending && (
          <>
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} lines={2} />
            ))}
          </>
        )}

        {news.isError && (
          <ErrorState
            title="Failed to load news"
            message={news.error?.message ?? "Unknown error"}
            size="compact"
            onRetry={() => news.refetch()}
          />
        )}

        {news.isSuccess && news.data.length === 0 && (
          <EmptyState
            icon={<Newspaper className="h-8 w-8" />}
            title="No news yet"
            description={
              instrument
                ? `No headlines tagged with ${instrument} yet.`
                : "Scheduled ingestion runs every 15 min during NSE hours."
            }
            size="compact"
          />
        )}

        {news.isSuccess && news.data.length > 0 && (
          <ul className="divide-y">
            {news.data.map((item) => (
              <NewsRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Single row ────────────────────────────────────────────────────────

function NewsRow({ item }: { item: NewsEvent }) {
  const decoded = decodeHtmlEntities(item.title);
  const taggedSymbols = (item.instruments ?? []).slice(0, 4);

  return (
    <li className="space-y-1 py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        {item.raw_url ? (
          <a
            href={item.raw_url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-start gap-1 text-sm font-medium leading-snug text-foreground hover:underline"
          >
            {decoded}
            <ExternalLink
              className="mt-0.5 h-3 w-3 flex-shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </a>
        ) : (
          <p className="text-sm font-medium leading-snug">{decoded}</p>
        )}
        <SentimentBadge score={item.sentiment_score} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span>{formatRelativeTime(item.ts)}</span>
        <span aria-hidden="true">·</span>
        <span className="font-mono">{item.source}</span>
        {taggedSymbols.length > 0 && (
          <>
            <span aria-hidden="true">·</span>
            {taggedSymbols.map((s) => (
              <Badge key={s} variant="secondary" className="font-mono text-[10px]">
                {s}
              </Badge>
            ))}
            {(item.instruments?.length ?? 0) > taggedSymbols.length && (
              <span className="text-[10px]">
                +{(item.instruments?.length ?? 0) - taggedSymbols.length}
              </span>
            )}
          </>
        )}
      </div>
    </li>
  );
}

// ─── Sentiment badge ───────────────────────────────────────────────────

function SentimentBadge({ score }: { score: number | null }) {
  if (score == null || !Number.isFinite(score)) {
    return (
      <span
        className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
        title="No sentiment scored yet"
      >
        —
      </span>
    );
  }

  // Bucket into up/flat/down for color; show numeric value
  const bucket = score > 0.15 ? "up" : score < -0.15 ? "down" : "flat";
  const bg =
    bucket === "up"
      ? "bg-up-soft text-up"
      : bucket === "down"
      ? "bg-down-soft text-down"
      : "bg-muted text-muted-foreground";

  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums",
        bg,
      )}
      title={`Sentiment score: ${score.toFixed(2)} (range −1 to +1)`}
    >
      <Numeric value={score} format="decimal" showSign maximumFractionDigits={2} />
    </span>
  );
}

// ─── HTML entity decode ────────────────────────────────────────────────
//
// MoneyControl's feed serves entities un-decoded (e.g. "Cyient DLM#39;s" for
// "Cyient DLM's"). Small browser-side decode pass; not worth a library.

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&quot;": '"',
  "&apos;": "'",
  "&lt;": "<",
  "&gt;": ">",
  "&#39;": "'",
  "&#34;": '"',
  "&nbsp;": " ",
};

function decodeHtmlEntities(input: string): string {
  if (!input) return input;
  return input
    .replace(/&(?:amp|quot|apos|lt|gt|nbsp);|&#\d+;/g, (m) => ENTITIES[m] ?? m)
    // Pages that strip the `&` and leave bare `#39;` (seen in MoneyControl feed)
    .replace(/(?<![&])#(\d+);/g, (_, code) => {
      const n = parseInt(code, 10);
      return Number.isFinite(n) ? String.fromCharCode(n) : _;
    });
}
