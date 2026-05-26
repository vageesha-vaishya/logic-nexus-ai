/**
 * PortfolioBriefSheet — bottom-sheet that shows the latest AI brief
 * for a portfolio. Slice 2 of the mobile portfolio detail surface
 * (see session analysis 2026-05-26).
 *
 * Behaviour:
 *   • Most-recent brief surfaces by default. Older briefs are reachable
 *     via a small "View older" link at the bottom of the sheet.
 *   • "Generate new" button kicks `useGenerateBrief()`. The mutation
 *     prepends the new brief into the cache (per useBriefs.ts:92), so
 *     the sheet rerenders without a refetch.
 *   • Markdown rendering is done by react-markdown which is already in
 *     the bundle (used by PortfolioDetailPage).
 */
import { useState } from "react";
import { Loader2, RefreshCw, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/design-system";
import { SheetDescription } from "@/components/ui/sheet";

import { useBriefs, useGenerateBrief } from "../../hooks/useBriefs";

export interface PortfolioBriefSheetProps {
  portfolioId: string | undefined;
  open:        boolean;
  onClose:     () => void;
}

export function PortfolioBriefSheet({ portfolioId, open, onClose }: PortfolioBriefSheetProps) {
  const briefsQuery = useBriefs(portfolioId);
  const generate    = useGenerateBrief(portfolioId);
  const [historyOpen, setHistoryOpen] = useState(false);

  const briefs    = briefsQuery.data ?? [];
  const latest    = briefs[0];
  const generating = generate.isPending;

  async function handleGenerate() {
    try {
      await generate.mutateAsync();
      toast.success("Brief generated");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate brief");
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="bottom"
        className="max-h-[88vh] overflow-y-auto rounded-t-xl"
      >
        <SheetHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <SheetTitle>Portfolio Brief</SheetTitle>
            <SheetDescription>
              AI-generated narrative of how this portfolio is positioned right now.
            </SheetDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Loading state */}
          {briefsQuery.isPending && (
            <p className="text-xs text-muted-foreground">Loading briefs…</p>
          )}

          {/* Empty state */}
          {briefsQuery.isSuccess && briefs.length === 0 && (
            <div className="rounded-md border bg-muted/30 p-4 text-center text-sm">
              <p className="text-muted-foreground">
                No briefs yet. Generate one to get a narrative of how this
                portfolio is positioned, what's driving today's P&amp;L, and
                what to watch.
              </p>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="mt-3 inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {generating
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Generating…</>
                  : <>Generate brief</>}
              </button>
            </div>
          )}

          {/* Latest brief */}
          {latest && (
            <article className="space-y-2">
              <header className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  {latest.title && (
                    <h3 className="text-sm font-semibold truncate">{latest.title}</h3>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    Generated {formatDistanceToNow(new Date(latest.ts), { addSuffix: true })}
                    {latest.llm_model && <> · {latest.llm_model}</>}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-medium hover:bg-accent disabled:opacity-60"
                  title="Regenerate"
                >
                  {generating
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <RefreshCw className="h-3 w-3" />}
                  Regenerate
                </button>
              </header>

              <div className="prose prose-sm max-w-none text-sm leading-relaxed
                              prose-headings:font-semibold prose-headings:text-foreground
                              prose-p:text-foreground prose-li:text-foreground
                              prose-strong:text-foreground prose-a:text-primary">
                <ReactMarkdown>{latest.body}</ReactMarkdown>
              </div>

              {/* Sources */}
              {latest.sources && latest.sources.length > 0 && (
                <details className="rounded border bg-muted/20 px-2.5 py-1.5 text-xs" open>
                  <summary className="cursor-pointer font-medium text-muted-foreground">
                    Sources ({latest.sources.length})
                  </summary>
                  <ul className="mt-1.5 space-y-1">
                    {latest.sources.map((s, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-muted-foreground">·</span>
                        {s.url ? (
                          <a href={s.url} target="_blank" rel="noopener noreferrer"
                            className="text-primary hover:underline">
                            {s.title}
                          </a>
                        ) : (
                          <span>{s.title}</span>
                        )}
                        <span className="text-muted-foreground">— {s.source}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </article>
          )}

          {/* Older briefs */}
          {briefs.length > 1 && (
            <div className="border-t pt-3">
              <button
                type="button"
                onClick={() => setHistoryOpen((v) => !v)}
                className="text-xs font-medium text-primary hover:underline"
              >
                {historyOpen ? "Hide" : "View"} older briefs ({briefs.length - 1})
              </button>
              {historyOpen && (
                <ul className="mt-2 space-y-2">
                  {briefs.slice(1).map((b) => (
                    <li key={b.id} className="rounded border bg-muted/20 px-3 py-2">
                      <p className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(b.ts), { addSuffix: true })}
                        {b.llm_model && <> · {b.llm_model}</>}
                      </p>
                      {b.title && <p className="text-xs font-medium mt-0.5">{b.title}</p>}
                      <p className="mt-1 text-xs line-clamp-3">{b.body.slice(0, 240)}…</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
