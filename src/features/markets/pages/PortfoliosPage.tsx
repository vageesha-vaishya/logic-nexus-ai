/**
 * Markets — portfolios page (v1.1, rewritten on ADR-026 primitives).
 *
 * Chain unchanged:
 *   React → react-query hooks → supabase.functions.invoke('markets-portfolios')
 *     → Edge Function (requireAuth → checkDomainAccess → schema('markets'))
 *     → Postgres RLS (owner_user_id = auth.uid())
 *
 * UI replaced:
 *   • Bare HTML form     → react-hook-form + shadcn primitives
 *   • Inline red text    → <ErrorState> with retry
 *   • "Loading…" text    → <SkeletonCard> matching final layout
 *   • Plain list         → portfolio cards w/ mode badge, KPI strip, sparkline
 *   • Numbers in JSX     → <Numeric> / <MoneyDelta>
 *   • alert / inline msg → sonner toast on create success
 */

import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Eye, Plus, Wallet } from "lucide-react";

import { usePortfolios, useCreatePortfolio } from "../hooks/usePortfolios";
import { NewsPanel } from "../components/NewsPanel";
import type { CreatePortfolioInput, Portfolio, PortfolioMode } from "../types";

import {
  Numeric,
  MoneyDelta,
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
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/design-system";
import { useState } from "react";

interface PortfolioFormValues {
  name: string;
  description: string;
  mode: PortfolioMode;
  base_currency: string;
}

const DEFAULT_FORM_VALUES: PortfolioFormValues = {
  name: "",
  description: "",
  mode: "paper",
  base_currency: "INR",
};

export default function PortfoliosPage() {
  const portfolios = usePortfolios();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Portfolios</h1>
          <p className="text-sm text-muted-foreground">
            Personal-use paper portfolios. Live (broker-integrated) mode deferred per §11 T2.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/dashboard/markets/watchlists")}>
            <Eye className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Watchlists
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            New portfolio
          </Button>
        </div>
      </header>

      {/* ─── Two-column layout: portfolios + news rail ──────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          {/* portfolios body */}
          {renderPortfolios(portfolios, setCreateOpen)}
        </div>
        <aside className="space-y-6">
          <NewsPanel limit={10} />
        </aside>
      </div>

      {/* ─── Create panel (slide-in sheet, ADR-026 §3) ──────────────── */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Create a portfolio</SheetTitle>
          </SheetHeader>
          <CreatePortfolioForm onSuccess={() => setCreateOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Extracted to keep the page body lean; pure presentation.
function renderPortfolios(
  portfolios: ReturnType<typeof usePortfolios>,
  setCreateOpen: (open: boolean) => void,
) {
  return (
    <>
      {portfolios.isPending && <PortfoliosSkeleton />}

      {portfolios.isError && (
        <ErrorState
          title="Failed to load portfolios"
          message={portfolios.error?.message ?? "Unknown error"}
          onRetry={() => portfolios.refetch()}
        />
      )}

      {portfolios.isSuccess && portfolios.data.length === 0 && (
        <EmptyState
          icon={<Wallet className="h-10 w-10" />}
          title="No portfolios yet"
          description="Create your first paper portfolio to start tracking holdings and generating AI briefs."
          actionLabel="Create a portfolio"
          onAction={() => setCreateOpen(true)}
          secondaryActionLabel="Use template"
          onSecondaryAction={() => {
            // TODO: open a template-picker sheet (long-only equity, balanced, F&O paper)
            toast.info("Templates coming soon");
          }}
        />
      )}

      {portfolios.isSuccess && portfolios.data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {portfolios.data.map((p) => (
            <PortfolioCard key={p.id} portfolio={p} />
          ))}
        </div>
      )}
    </>
  );
}

// ─── Portfolio card ────────────────────────────────────────────────────

function PortfolioCard({ portfolio }: { portfolio: Portfolio }) {
  // v1 has no real holdings/P&L yet — render placeholder series + zeros.
  // These will be wired to markets.holdings + markets.price_history in T2.
  const placeholderSeries = generatePlaceholderSeries();
  const navValue = readMetadataNumber(portfolio.metadata, "nav_value") ?? 0;
  const dayChange = readMetadataNumber(portfolio.metadata, "day_change_value");
  const dayChangePct = readMetadataNumber(portfolio.metadata, "day_change_pct");

  return (
    <Card className="group transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="truncate text-base">
            <Link
              to={`/dashboard/markets/portfolios/${portfolio.id}`}
              className="outline-none hover:underline focus-visible:underline"
            >
              {portfolio.name}
            </Link>
          </CardTitle>
          {portfolio.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {portfolio.description}
            </p>
          )}
        </div>
        <Badge
          variant={portfolio.mode === "live" ? "default" : "secondary"}
          className="shrink-0 capitalize"
        >
          {portfolio.mode}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* KPI strip */}
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">NAV</p>
            <Numeric
              value={navValue}
              format="currency"
              currency={portfolio.base_currency}
              className="text-xl font-semibold"
            />
          </div>
          <Sparkline series={placeholderSeries} accessibleLabel="Recent NAV trend" />
        </div>

        {/* Day change */}
        <div className="flex items-center justify-between border-t pt-3 text-sm">
          <span className="text-muted-foreground">Today</span>
          <MoneyDelta
            value={dayChange ?? 0}
            secondary={dayChangePct ?? 0}
            currency={portfolio.base_currency}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function PortfoliosSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <SkeletonCard key={i} lines={4} />
      ))}
    </div>
  );
}

// ─── Create form ───────────────────────────────────────────────────────

function CreatePortfolioForm({ onSuccess }: { onSuccess: () => void }) {
  const createPortfolio = useCreatePortfolio();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PortfolioFormValues>({
    defaultValues: DEFAULT_FORM_VALUES,
    mode: "onBlur",
  });

  const mode = watch("mode");

  const onSubmit = handleSubmit(async (values) => {
    const payload: CreatePortfolioInput = {
      name: values.name,
      description: values.description?.trim() ? values.description.trim() : null,
      mode: values.mode,
      base_currency: values.base_currency.toUpperCase(),
    };
    try {
      const created = await createPortfolio.mutateAsync(payload);
      toast.success(`Portfolio "${created.name}" created`);
      reset(DEFAULT_FORM_VALUES);
      onSuccess();
    } catch (e: any) {
      // Toast also; create button shows ErrorState inline.
      toast.error(`Could not create portfolio: ${e?.message ?? "Unknown error"}`);
    }
  });

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="portfolio-name">Name</Label>
        <Input
          id="portfolio-name"
          type="text"
          placeholder="e.g. Long-only equity"
          {...register("name", {
            required: "Name is required",
            minLength: { value: 1, message: "Name cannot be empty" },
            maxLength: { value: 100, message: "Max 100 chars" },
          })}
          aria-invalid={errors.name ? "true" : "false"}
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="portfolio-description">Description (optional)</Label>
        <Input
          id="portfolio-description"
          type="text"
          placeholder="What is this portfolio for?"
          {...register("description", {
            maxLength: { value: 500, message: "Max 500 chars" },
          })}
        />
        {errors.description && (
          <p className="text-xs text-destructive">{errors.description.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="portfolio-mode">Mode</Label>
          <Select
            value={mode}
            onValueChange={(v) => setValue("mode", v as PortfolioMode)}
          >
            <SelectTrigger id="portfolio-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="paper">paper</SelectItem>
              <SelectItem value="live" disabled>
                live (deferred)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="portfolio-currency">Base currency</Label>
          <Input
            id="portfolio-currency"
            type="text"
            maxLength={3}
            className="uppercase"
            {...register("base_currency", {
              required: true,
              pattern: {
                value: /^[A-Za-z]{3}$/,
                message: "3-letter ISO code (INR, USD, ...)",
              },
            })}
          />
          {errors.base_currency && (
            <p className="text-xs text-destructive">{errors.base_currency.message}</p>
          )}
        </div>
      </div>

      {createPortfolio.isError && (
        <ErrorState
          title="Could not save"
          message={createPortfolio.error?.message ?? "Unknown error"}
          size="compact"
          onRetry={onSubmit}
        />
      )}

      <div className="flex items-center gap-2 pt-2">
        <Button
          type="submit"
          disabled={isSubmitting || createPortfolio.isPending}
        >
          {createPortfolio.isPending ? "Creating…" : "Create portfolio"}
        </Button>
        <Button type="button" variant="ghost" onClick={onSuccess}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────

function readMetadataNumber(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
): number | null {
  if (!metadata) return null;
  const v = metadata[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Visual-only deterministic-but-feels-random series for the sparkline.
 * Removed when markets.price_history wiring lands (T2).
 */
function generatePlaceholderSeries(): number[] {
  const len = 30;
  const seed = Date.now() % 10_000;
  return Array.from({ length: len }).map((_, i) => {
    const t = i / (len - 1);
    return (
      100 +
      Math.sin((seed + i) * 0.7) * 4 +
      t * 8 +
      Math.cos((seed + i) * 0.3) * 2
    );
  });
}
