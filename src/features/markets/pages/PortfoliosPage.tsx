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

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Eye, Loader2, Plus, Search, Wallet } from "lucide-react";

import { usePortfolios, useCreatePortfolio, useCrmContactSearch } from "../hooks/usePortfolios";
import { NewsPanel } from "../components/NewsPanel";
import type {
  CreatePortfolioInput,
  CrmContactSearchResult,
  Portfolio,
  PortfolioHolderType,
  PortfolioMode,
} from "../types";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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

interface PortfolioFormValues {
  name: string;
  description: string;
  mode: PortfolioMode;
  base_currency: string;
  holder_type: PortfolioHolderType;
}

const DEFAULT_FORM_VALUES: PortfolioFormValues = {
  name: "",
  description: "",
  mode: "paper",
  base_currency: "INR",
  holder_type: "self_directed",
};

const HOLDER_TYPE_LABELS: Record<PortfolioHolderType, string> = {
  self_directed: "Self-directed (my own)",
  individual:    "Individual client",
  huf:           "HUF",
  corporate:     "Corporate / Company",
  joint:         "Joint account",
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
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge variant={portfolio.mode === "live" ? "default" : "secondary"} className="capitalize">
            {portfolio.mode}
          </Badge>
          {portfolio.holder_type !== "self_directed" && (
            <Badge variant="outline" className="text-xs capitalize">
              {portfolio.holder_type}
            </Badge>
          )}
        </div>
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
  const [selectedContact, setSelectedContact] = useState<CrmContactSearchResult | null>(null);
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [contactQuery, setContactQuery] = useState("");
  const contactSearch = useCrmContactSearch(contactQuery);

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

  const mode       = watch("mode");
  const holderType = watch("holder_type");
  const isManaged  = holderType !== "self_directed";

  const onSubmit = handleSubmit(async (values) => {
    if (isManaged && !selectedContact) {
      toast.error("Select a client contact for this portfolio type");
      return;
    }
    const payload: CreatePortfolioInput = {
      name:         values.name,
      description:  values.description?.trim() || null,
      mode:         values.mode,
      base_currency: values.base_currency.toUpperCase(),
      holder_type:  values.holder_type,
      contact_id:   selectedContact?.id ?? null,
      account_id:   selectedContact?.account_id ?? null,
    };
    try {
      const created = await createPortfolio.mutateAsync(payload);
      toast.success(`Portfolio "${created.name}" created`);
      reset(DEFAULT_FORM_VALUES);
      setSelectedContact(null);
      setContactQuery("");
      onSuccess();
    } catch (e: any) {
      toast.error(`Could not create portfolio: ${e?.message ?? "Unknown error"}`);
    }
  });

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4">

      {/* Holder type */}
      <div className="space-y-1.5">
        <Label>Portfolio type</Label>
        <Select
          value={holderType}
          onValueChange={(v) => {
            setValue("holder_type", v as PortfolioHolderType);
            setSelectedContact(null);
            setContactQuery("");
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(HOLDER_TYPE_LABELS) as [PortfolioHolderType, string][]).map(([v, label]) => (
              <SelectItem key={v} value={v}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Contact picker — only for managed portfolios */}
      {isManaged && (
        <div className="space-y-1.5">
          <Label>Client contact <span className="text-destructive">*</span></Label>
          <Popover open={contactPickerOpen} onOpenChange={setContactPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                className="w-full justify-between font-normal"
              >
                {selectedContact
                  ? `${selectedContact.first_name} ${selectedContact.last_name} — ${selectedContact.account_name}`
                  : "Search by name or email…"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[24rem] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Name or email…"
                  value={contactQuery}
                  onValueChange={setContactQuery}
                />
                <CommandList className="max-h-64">
                  {contactQuery.length < 2 && (
                    <div className="flex items-center gap-2 px-4 py-5 text-sm text-muted-foreground">
                      <Search className="h-4 w-4" />
                      Type at least 2 characters to search contacts.
                    </div>
                  )}
                  {contactQuery.length >= 2 && contactSearch.isPending && (
                    <div className="flex items-center justify-center gap-2 p-5 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Searching…
                    </div>
                  )}
                  {contactQuery.length >= 2 && contactSearch.isSuccess && (
                    <>
                      <CommandEmpty>No contacts matched.</CommandEmpty>
                      {contactSearch.data.length > 0 && (
                        <CommandGroup>
                          {contactSearch.data.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={c.id}
                              onSelect={() => {
                                setSelectedContact(c);
                                setContactPickerOpen(false);
                                setContactQuery("");
                              }}
                              className="flex items-center gap-2"
                            >
                              <Check className={cn("h-4 w-4", selectedContact?.id === c.id ? "opacity-100" : "opacity-0")} />
                              <div>
                                <p className="text-sm font-medium">
                                  {c.first_name} {c.last_name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {c.account_name}{c.email ? ` · ${c.email}` : ""}
                                </p>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {isManaged && !selectedContact && (
            <p className="text-xs text-muted-foreground">
              Account will be auto-filled from the contact's CRM record.
            </p>
          )}
          {selectedContact && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              Account: {selectedContact.account_name}
            </p>
          )}
        </div>
      )}

      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="portfolio-name">Portfolio name</Label>
        <Input
          id="portfolio-name"
          type="text"
          placeholder="e.g. Long-only equity"
          {...register("name", {
            required: "Name is required",
            maxLength: { value: 100, message: "Max 100 chars" },
          })}
          aria-invalid={errors.name ? "true" : "false"}
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="portfolio-description">Description (optional)</Label>
        <Input
          id="portfolio-description"
          type="text"
          placeholder="What is this portfolio for?"
          {...register("description", { maxLength: { value: 500, message: "Max 500 chars" } })}
        />
      </div>

      {/* Mode + currency */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Mode</Label>
          <Select value={mode} onValueChange={(v) => setValue("mode", v as PortfolioMode)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="paper">paper</SelectItem>
              <SelectItem value="live" disabled>live (deferred)</SelectItem>
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
              pattern: { value: /^[A-Za-z]{3}$/, message: "3-letter code (INR, USD…)" },
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
        <Button type="submit" disabled={isSubmitting || createPortfolio.isPending}>
          {createPortfolio.isPending ? "Creating…" : "Create portfolio"}
        </Button>
        <Button type="button" variant="ghost" onClick={onSuccess}>Cancel</Button>
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
