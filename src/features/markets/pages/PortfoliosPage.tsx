/**
 * Markets — Portfolios page.
 * Full CRUD: list, create (sheet), edit (sheet), delete (confirm dialog).
 * Contact search: inline autocomplete input, no Popover trigger needed.
 */

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Edit2,
  Eye,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Wallet,
  X,
} from "lucide-react";

import {
  usePortfolios,
  useCreatePortfolio,
  useUpdatePortfolio,
  useDeletePortfolio,
  useCrmContactSearch,
  type UpdatePortfolioInput,
} from "../hooks/usePortfolios";
import { NewsPanel } from "../components/NewsPanel";
import type {
  CreatePortfolioInput,
  CrmContactSearchResult,
  Portfolio,
  PortfolioHolderType,
  PortfolioMode,
} from "../types";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

// ─── Types ────────────────────────────────────────────────────────────────

interface PortfolioFormValues {
  name: string;
  description: string;
  mode: PortfolioMode;
  base_currency: string;
  holder_type: PortfolioHolderType;
}

const DEFAULT_FORM: PortfolioFormValues = {
  name: "",
  description: "",
  mode: "paper",
  base_currency: "INR",
  holder_type: "self_directed",
};

const HOLDER_TYPE_LABELS: Record<PortfolioHolderType, string> = {
  self_directed: "Self-directed (my own)",
  individual:    "Individual client",
  huf:           "HUF (Hindu Undivided Family)",
  corporate:     "Corporate / Company",
  joint:         "Joint account",
};

const MODE_OPTIONS: { value: PortfolioMode; label: string; description: string }[] = [
  { value: "paper", label: "Paper",  description: "Simulated — no real money, safe for backtesting" },
  { value: "live",  label: "Live",   description: "Real broker-connected portfolio (T2 broker integration)" },
];

// Common currencies ordered by relevance to the platform
const CURRENCIES: { code: string; name: string }[] = [
  { code: "INR", name: "Indian Rupee" },
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "AED", name: "UAE Dirham" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "HKD", name: "Hong Kong Dollar" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "MYR", name: "Malaysian Ringgit" },
  { code: "THB", name: "Thai Baht" },
  { code: "ZAR", name: "South African Rand" },
];

// ─── Page ─────────────────────────────────────────────────────────────────

export default function PortfoliosPage() {
  const portfolios  = usePortfolios();
  const navigate    = useNavigate();

  const [createOpen,       setCreateOpen]       = useState(false);
  const [editPortfolio,    setEditPortfolio]     = useState<Portfolio | null>(null);
  const [deletePortfolio,  setDeletePortfolio]   = useState<Portfolio | null>(null);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Portfolios</h1>
          <p className="text-sm text-muted-foreground">
            Track holdings, NAV and AI market briefs for each portfolio.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/dashboard/markets/watchlists")}>
            <Eye className="mr-1.5 h-4 w-4" />
            Watchlists
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            New portfolio
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
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
              description="Create your first portfolio to start tracking holdings and generating AI briefs."
              actionLabel="Create a portfolio"
              onAction={() => setCreateOpen(true)}
              secondaryActionLabel="Use template"
              onSecondaryAction={() => toast.info("Templates coming soon")}
            />
          )}

          {portfolios.isSuccess && portfolios.data.length > 0 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {portfolios.data.map((p) => (
                <PortfolioCard
                  key={p.id}
                  portfolio={p}
                  onEdit={() => setEditPortfolio(p)}
                  onDelete={() => setDeletePortfolio(p)}
                />
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <NewsPanel limit={10} />
        </aside>
      </div>

      {/* Create sheet */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Create a portfolio</SheetTitle>
          </SheetHeader>
          <PortfolioForm
            mode="create"
            onSuccess={() => setCreateOpen(false)}
            onCancel={() => setCreateOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Edit sheet */}
      <Sheet open={Boolean(editPortfolio)} onOpenChange={(o) => { if (!o) setEditPortfolio(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit portfolio</SheetTitle>
          </SheetHeader>
          {editPortfolio && (
            <PortfolioForm
              mode="edit"
              portfolio={editPortfolio}
              onSuccess={() => setEditPortfolio(null)}
              onCancel={() => setEditPortfolio(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Delete dialog */}
      <DeletePortfolioDialog
        portfolio={deletePortfolio}
        onClose={() => setDeletePortfolio(null)}
      />
    </div>
  );
}

// ─── Portfolio card ────────────────────────────────────────────────────────

function PortfolioCard({
  portfolio,
  onEdit,
  onDelete,
}: {
  portfolio: Portfolio;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const placeholderSeries = generatePlaceholderSeries();
  const navValue    = readMetaNum(portfolio.metadata, "nav_value")     ?? 0;
  const dayChange   = readMetaNum(portfolio.metadata, "day_change_value");
  const dayChangePct = readMetaNum(portfolio.metadata, "day_change_pct");

  return (
    <Card className="group transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0 flex-1">
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
          <div className="mt-1.5 flex flex-wrap gap-1">
            <Badge
              variant={portfolio.mode === "live" ? "default" : "secondary"}
              className="text-xs capitalize"
            >
              {portfolio.mode}
            </Badge>
            {portfolio.holder_type !== "self_directed" && (
              <Badge variant="outline" className="text-xs capitalize">
                {HOLDER_TYPE_LABELS[portfolio.holder_type] ?? portfolio.holder_type}
              </Badge>
            )}
          </div>
        </div>

        {/* Actions menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100"
              aria-label="Portfolio actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={onEdit}>
              <Edit2 className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent className="space-y-3">
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
        <div className="flex items-center justify-between border-t pt-3 text-sm">
          <span className="text-muted-foreground">Today</span>
          <MoneyDelta value={dayChange ?? 0} secondary={dayChangePct ?? 0} currency={portfolio.base_currency} />
        </div>
      </CardContent>
    </Card>
  );
}

function PortfoliosSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} lines={4} />)}
    </div>
  );
}

// ─── Shared form (Create + Edit) ──────────────────────────────────────────

function PortfolioForm({
  mode,
  portfolio,
  onSuccess,
  onCancel,
}: {
  mode: "create" | "edit";
  portfolio?: Portfolio;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const createMutation = useCreatePortfolio();
  const updateMutation = useUpdatePortfolio();
  const isPending = mode === "create" ? createMutation.isPending : updateMutation.isPending;

  const [selectedContact, setSelectedContact] = useState<CrmContactSearchResult | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PortfolioFormValues>({
    defaultValues: portfolio
      ? {
          name:          portfolio.name,
          description:   portfolio.description ?? "",
          mode:          portfolio.mode,
          base_currency: portfolio.base_currency,
          holder_type:   portfolio.holder_type,
        }
      : DEFAULT_FORM,
    mode: "onBlur",
  });

  const watchedMode       = watch("mode");
  const watchedHolderType = watch("holder_type");
  const isManaged         = watchedHolderType !== "self_directed";

  const onSubmit = handleSubmit(async (values) => {
    if (isManaged && !selectedContact && mode === "create") {
      toast.error("Select a client contact for this portfolio type");
      return;
    }

    try {
      if (mode === "create") {
        const payload: CreatePortfolioInput = {
          name:          values.name,
          description:   values.description?.trim() || null,
          mode:          values.mode,
          base_currency: values.base_currency.toUpperCase(),
          holder_type:   values.holder_type,
          contact_id:    selectedContact?.id ?? null,
          account_id:    selectedContact?.account_id ?? null,
        };
        const created = await createMutation.mutateAsync(payload);
        toast.success(`Portfolio "${created.name}" created`);
        reset(DEFAULT_FORM);
        setSelectedContact(null);
      } else {
        const payload: UpdatePortfolioInput = {
          id:            portfolio!.id,
          name:          values.name,
          description:   values.description?.trim() || null,
          mode:          values.mode,
          base_currency: values.base_currency.toUpperCase(),
          holder_type:   values.holder_type,
          contact_id:    selectedContact?.id ?? portfolio!.contact_id,
          account_id:    selectedContact?.account_id ?? portfolio!.account_id,
        };
        const updated = await updateMutation.mutateAsync(payload);
        toast.success(`Portfolio "${updated.name}" updated`);
      }
      onSuccess();
    } catch (e: any) {
      toast.error(e?.message ?? "Something went wrong");
    }
  });

  const mutationError = mode === "create" ? createMutation.error : updateMutation.error;

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-5">

      {/* Portfolio type */}
      <div className="space-y-1.5">
        <Label>Portfolio type</Label>
        <Select
          value={watchedHolderType}
          onValueChange={(v) => {
            setValue("holder_type", v as PortfolioHolderType);
            setSelectedContact(null);
          }}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.entries(HOLDER_TYPE_LABELS) as [PortfolioHolderType, string][]).map(([v, label]) => (
              <SelectItem key={v} value={v}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Client contact picker — only for managed types */}
      {isManaged && (
        <div className="space-y-1.5">
          <Label>
            Client contact <span className="text-destructive">*</span>
          </Label>
          <ContactAutocomplete
            value={selectedContact}
            onChange={setSelectedContact}
            initialLabel={
              mode === "edit" && portfolio?.contact_id
                ? `${portfolio.contact_id} (loaded from record)`
                : undefined
            }
          />
          {selectedContact ? (
            <p className="text-xs text-emerald-600">
              Account: {selectedContact.account_name}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Account will be auto-filled from the contact's CRM record.
            </p>
          )}
        </div>
      )}

      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="pf-name">Portfolio name</Label>
        <Input
          id="pf-name"
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
        <Label htmlFor="pf-desc">Description (optional)</Label>
        <Input
          id="pf-desc"
          placeholder="What is this portfolio for?"
          {...register("description", { maxLength: { value: 500, message: "Max 500 chars" } })}
        />
      </div>

      {/* Mode */}
      <div className="space-y-1.5">
        <Label>Mode</Label>
        <Select value={watchedMode} onValueChange={(v) => setValue("mode", v as PortfolioMode)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {MODE_OPTIONS.map(({ value, label, description }) => (
              <SelectItem key={value} value={value}>
                <div className="flex flex-col">
                  <span className="font-medium">{label}</span>
                  <span className="text-xs text-muted-foreground">{description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {watchedMode === "live" && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Live mode requires broker integration — configure in Markets settings before use.
          </p>
        )}
      </div>

      {/* Base currency */}
      <div className="space-y-1.5">
        <Label>Base currency</Label>
        <Select
          value={watch("base_currency")}
          onValueChange={(v) => setValue("base_currency", v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select currency" />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map(({ code, name }) => (
              <SelectItem key={code} value={code}>
                <span className="font-mono font-medium">{code}</span>
                <span className="ml-2 text-muted-foreground">{name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {mutationError && (
        <ErrorState
          title="Could not save"
          message={mutationError.message}
          size="compact"
          onRetry={onSubmit}
        />
      )}

      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" disabled={isSubmitting || isPending}>
          {isPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{mode === "create" ? "Creating…" : "Saving…"}</>
          ) : (
            mode === "create" ? "Create portfolio" : "Save changes"
          )}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

// ─── Contact autocomplete input ───────────────────────────────────────────

function ContactAutocomplete({
  value,
  onChange,
  initialLabel,
}: {
  value: CrmContactSearchResult | null;
  onChange: (c: CrmContactSearchResult | null) => void;
  initialLabel?: string;
}) {
  const [query, setQuery]   = useState("");
  const [open,  setOpen]    = useState(false);
  const inputRef            = useRef<HTMLInputElement>(null);
  const search              = useCrmContactSearch(query);

  // Selected state — show chip
  if (value) {
    const initials = `${value.first_name[0] ?? ""}${value.last_name[0] ?? ""}`.toUpperCase();
    return (
      <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {value.first_name} {value.last_name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {value.account_name}{value.email ? ` · ${value.email}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="rounded p-1 hover:bg-muted"
          aria-label="Clear contact"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search by name or email…"
          value={query}
          className="pl-9 pr-9"
          autoComplete="off"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(e.target.value.length >= 2);
          }}
          onFocus={() => { if (query.length >= 2) setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {search.isFetching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Dropdown results */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-md border bg-popover shadow-lg">
          {query.length < 2 && (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              Type at least 2 characters to search
            </p>
          )}

          {query.length >= 2 && search.isPending && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching contacts…
            </div>
          )}

          {query.length >= 2 && search.isSuccess && search.data.length === 0 && (
            <p className="px-4 py-3 text-sm text-muted-foreground">No contacts matched.</p>
          )}

          {query.length >= 2 && search.isSuccess && search.data.map((c) => {
            const initials = `${c.first_name[0] ?? ""}${c.last_name[0] ?? ""}`.toUpperCase();
            return (
              <button
                key={c.id}
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent focus:bg-accent focus:outline-none"
                onMouseDown={(e) => {
                  e.preventDefault(); // prevent input blur before selection
                  onChange(c);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {c.first_name} {c.last_name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.account_name}{c.email ? ` · ${c.email}` : ""}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Delete confirmation dialog ───────────────────────────────────────────

function DeletePortfolioDialog({
  portfolio,
  onClose,
}: {
  portfolio: Portfolio | null;
  onClose: () => void;
}) {
  const deletePortfolio = useDeletePortfolio();

  const handleConfirm = async () => {
    if (!portfolio) return;
    try {
      await deletePortfolio.mutateAsync(portfolio.id);
      toast.success(`Portfolio "${portfolio.name}" deleted`);
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete portfolio");
    }
  };

  return (
    <AlertDialog open={Boolean(portfolio)} onOpenChange={(o) => { if (!o) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete portfolio?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>"{portfolio?.name}"</strong> and all its holdings data will be permanently
            removed. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={deletePortfolio.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deletePortfolio.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting…</>
            ) : (
              "Delete portfolio"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function readMetaNum(
  meta: Record<string, unknown> | null | undefined,
  key: string,
): number | null {
  if (!meta) return null;
  const v = meta[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function generatePlaceholderSeries(): number[] {
  const len  = 30;
  const seed = Date.now() % 10_000;
  return Array.from({ length: len }).map((_, i) => {
    const t = i / (len - 1);
    return 100 + Math.sin((seed + i) * 0.7) * 4 + t * 8 + Math.cos((seed + i) * 0.3) * 2;
  });
}
