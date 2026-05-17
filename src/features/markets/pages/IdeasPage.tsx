import { useMemo, useState } from "react";
import { Lightbulb, Plus, Search, Users } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  SkeletonCard,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/design-system";
import { useAuth } from "@/hooks/useAuth";
import { IdeaCard } from "../components/IdeaCard";
import { CreateIdeaModal } from "../components/CreateIdeaModal";
import { useIdeasFeed, type IdeaItem } from "../hooks/useIdeas";

type FeedType = "all" | "following";
type DirectionFilter = "all" | "bullish" | "bearish" | "neutral";

function useTrendingSymbols(pages: { data: IdeaItem[] }[]): string[] {
  return useMemo(() => {
    const counts: Record<string, number> = {};
    for (const page of pages) {
      for (const idea of page.data) {
        if (idea.symbol) counts[idea.symbol] = (counts[idea.symbol] ?? 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([sym]) => sym);
  }, [pages]);
}

function useRecentOwnIdeas(pages: { data: IdeaItem[] }[], userId: string | undefined): IdeaItem[] {
  return useMemo(() => {
    if (!userId) return [];
    return pages
      .flatMap((p) => p.data)
      .filter((i) => i.user_id === userId)
      .slice(0, 3);
  }, [pages, userId]);
}

function DirectionChip({
  value,
  active,
  onClick,
}: {
  value: DirectionFilter;
  active: boolean;
  onClick: () => void;
}) {
  const labels: Record<DirectionFilter, string> = {
    all: "All",
    bullish: "Bullish",
    bearish: "Bearish",
    neutral: "Neutral",
  };
  const colors: Record<DirectionFilter, string> = {
    all: "",
    bullish: "text-emerald-600 border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/15",
    bearish: "text-rose-600 border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/15",
    neutral: "text-muted-foreground border-muted-foreground/30 bg-muted/50 hover:bg-muted",
  };
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? value === "all"
            ? "bg-primary text-primary-foreground border-primary"
            : colors[value]
          : "border-border text-muted-foreground hover:bg-muted"
      }`}
    >
      {labels[value]}
    </button>
  );
}

export default function IdeasPage() {
  const [feed, setFeed] = useState<FeedType>("all");
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [symbolSearch, setSymbolSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const { user } = useAuth();

  const params = {
    feed,
    symbol: symbolSearch.trim().toUpperCase() || undefined,
    direction: direction === "all" ? undefined : direction,
  };

  const query = useIdeasFeed(params);
  const pages = query.data?.pages ?? [];
  const allIdeas = pages.flatMap((p) => p.data);

  const trending = useTrendingSymbols(pages);
  const recentOwn = useRecentOwnIdeas(pages, user?.id);

  const isEmpty = query.isSuccess && allIdeas.length === 0;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Trade Ideas
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Share and discover trade ideas from the community
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Share Idea
          </Button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          {/* Feed */}
          <div className="space-y-4 min-w-0">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <Tabs value={feed} onValueChange={(v) => setFeed(v as FeedType)}>
                <TabsList className="h-8">
                  <TabsTrigger value="all" className="text-xs px-3">All</TabsTrigger>
                  <TabsTrigger value="following" className="text-xs px-3 flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Following
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex items-center gap-1.5">
                {(["all", "bullish", "bearish", "neutral"] as DirectionFilter[]).map((d) => (
                  <DirectionChip
                    key={d}
                    value={d}
                    active={direction === d}
                    onClick={() => setDirection(d)}
                  />
                ))}
              </div>

              <div className="relative flex-1 min-w-[160px] max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Filter by symbol…"
                  className="pl-8 h-8 text-xs font-mono"
                  value={symbolSearch}
                  onChange={(e) => setSymbolSearch(e.target.value.toUpperCase())}
                />
              </div>
            </div>

            {/* Skeletons */}
            {query.isPending && (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonCard key={i} lines={4} />
                ))}
              </div>
            )}

            {/* Empty state — following with no follows */}
            {isEmpty && feed === "following" && (
              <EmptyState
                title="No ideas yet"
                description="Follow traders to see their ideas here. Switch to All to discover ideas from the community."
              />
            )}

            {/* Empty state — general */}
            {isEmpty && feed === "all" && (
              <EmptyState
                title="No ideas found"
                description={
                  symbolSearch || direction !== "all"
                    ? "No ideas match your current filters. Try adjusting them."
                    : "Be the first to share a trade idea with the community!"
                }
              />
            )}

            {/* Feed cards */}
            {allIdeas.length > 0 && (
              <div className="space-y-3">
                {allIdeas.map((idea) => (
                  <IdeaCard key={idea.id} idea={idea} />
                ))}
              </div>
            )}

            {/* Load more */}
            {query.hasNextPage && (
              <div className="pt-2 flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => query.fetchNextPage()}
                  disabled={query.isFetchingNextPage}
                  className="w-full max-w-xs"
                >
                  {query.isFetchingNextPage ? "Loading…" : "Load more"}
                </Button>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="space-y-4 hidden lg:block">
            {/* Trending symbols */}
            {trending.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Trending Symbols</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {trending.map((sym, i) => (
                      <div key={sym} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-4 tabular-nums">{i + 1}</span>
                          <button
                            onClick={() => setSymbolSearch(sym)}
                            className="font-mono text-sm font-medium hover:text-primary transition-colors"
                          >
                            {sym}
                          </button>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {pages.flatMap((p) => p.data).filter((d) => d.symbol === sym).length} ideas
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Your recent ideas */}
            {recentOwn.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Your Recent Ideas</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {recentOwn.map((idea) => (
                    <div key={idea.id} className="space-y-0.5">
                      <p className="text-xs font-medium line-clamp-2 leading-snug">{idea.title}</p>
                      <div className="flex items-center gap-2">
                        {idea.symbol && (
                          <span className="font-mono text-xs text-muted-foreground">{idea.symbol}</span>
                        )}
                        <span className={`text-xs font-medium ${
                          idea.direction === "bullish"
                            ? "text-emerald-600"
                            : idea.direction === "bearish"
                            ? "text-rose-500"
                            : "text-muted-foreground"
                        }`}>
                          {idea.direction}
                        </span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </aside>
        </div>
      </div>

      <CreateIdeaModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </DashboardLayout>
  );
}
