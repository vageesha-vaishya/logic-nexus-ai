/**
 * Markets — AI Portfolio Advisor Card.
 *
 * Renders the latest Claude-generated portfolio brief.
 * Displays sections parsed from the Markdown response (no react-markdown dep).
 *
 * Props: { portfolioId: string }
 */

import { Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatRelativeTime } from "@/lib/format";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  SkeletonCard,
  EmptyState,
} from "@/design-system";
import {
  usePortfolioAdvisor,
  useGeneratePortfolioAdvisor,
} from "../hooks/usePortfolioAdvisor";

// ── Markdown section renderer (no extra dependency) ───────────────────────────

function renderBrief(content: string): React.ReactNode {
  const sections = content.split(/^## /m).filter(Boolean);

  return sections.map((section, i) => {
    const newlineIdx = section.indexOf("\n");
    const title = newlineIdx === -1 ? section.trim() : section.slice(0, newlineIdx).trim();
    const body  = newlineIdx === -1 ? "" : section.slice(newlineIdx + 1).trim();

    return (
      <div key={i} className="space-y-1.5">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <div className="text-sm text-muted-foreground whitespace-pre-line">
          {body}
        </div>
      </div>
    );
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

interface PortfolioAdvisorCardProps {
  portfolioId: string;
}

export function PortfolioAdvisorCard({ portfolioId }: PortfolioAdvisorCardProps) {
  const brief    = usePortfolioAdvisor(portfolioId);
  const generate = useGeneratePortfolioAdvisor(portfolioId);

  const onGenerate = async () => {
    try {
      await generate.mutateAsync();
      toast.success("AI brief generated");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast.error(`Failed to generate brief: ${msg}`);
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (brief.isPending) {
    return <SkeletonCard withHeader lines={6} />;
  }

  // ── Empty state — no brief yet ─────────────────────────────────────────────
  if (brief.isSuccess && !brief.data) {
    return (
      <EmptyState
        icon={<Sparkles className="h-10 w-10 text-violet-500" />}
        title="Get your AI Portfolio Brief"
        description="Claude analyses your holdings, sector allocation, technical signals, and P&L to deliver actionable insights — something no Indian broker currently offers."
        actionLabel={generate.isPending ? "Generating…" : "Generate AI brief"}
        onAction={onGenerate}
      />
    );
  }

  // ── Error from query ───────────────────────────────────────────────────────
  if (brief.isError) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Failed to load advisor brief.{" "}
          <button
            type="button"
            className="underline hover:text-foreground"
            onClick={() => brief.refetch()}
          >
            Retry
          </button>
        </CardContent>
      </Card>
    );
  }

  const data = brief.data!;

  return (
    <Card>
      {/* Header */}
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500 shrink-0" />
          <CardTitle className="text-base">AI Portfolio Advisor</CardTitle>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onGenerate}
            disabled={generate.isPending}
            className="h-7 px-2.5 text-xs"
          >
            <RefreshCw
              className={`mr-1.5 h-3.5 w-3.5 ${generate.isPending ? "animate-spin" : ""}`}
            />
            {generate.isPending ? "Generating…" : "Regenerate"}
          </Button>
          {data.generated_at && (
            <span className="text-[11px] text-muted-foreground">
              Generated {formatRelativeTime(data.generated_at)}
            </span>
          )}
        </div>
      </CardHeader>

      {/* Brief content */}
      <CardContent className="space-y-5 pt-0">
        {renderBrief(data.content)}

        {/* Disclaimer */}
        <p className="mt-4 text-[11px] text-muted-foreground border-t pt-3">
          AI-generated analysis is not financial advice. Always conduct your own due diligence before making investment decisions.
        </p>
      </CardContent>
    </Card>
  );
}
