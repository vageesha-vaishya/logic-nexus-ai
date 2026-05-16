/**
 * Markets — watchlists list page.
 *
 * Route: /dashboard/markets/watchlists
 *
 * Mirrors PortfoliosPage in structure: cards in a grid, slide-in create sheet,
 * NewsPanel rail. Watchlists differ from portfolios in that they're lightweight
 * (no holdings, no NAV), so cards just show name + item count + default badge.
 */

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Eye, Plus, Star, Trash2 } from "lucide-react";

import {
  useWatchlists,
  useCreateWatchlist,
  useDeleteWatchlist,
} from "../hooks/useWatchlists";
import { NewsPanel } from "../components/NewsPanel";
import type { CreateWatchlistInput, Watchlist } from "../types";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Input,
  Label,
  SkeletonCard,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Switch,
} from "@/design-system";

interface WatchlistFormValues {
  name: string;
  is_default: boolean;
}

export default function WatchlistsPage() {
  const watchlists = useWatchlists();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <DashboardLayout>
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Watchlists</h1>
          <p className="text-sm text-muted-foreground">
            Track instruments you care about without holding them. Each watchlist groups instruments
            for quick monitoring and richer AI brief context.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          New watchlist
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          {watchlists.isPending && <WatchlistsSkeleton />}

          {watchlists.isError && (
            <ErrorState
              title="Failed to load watchlists"
              message={watchlists.error?.message ?? "Unknown error"}
              onRetry={() => watchlists.refetch()}
            />
          )}

          {watchlists.isSuccess && watchlists.data.length === 0 && (
            <EmptyState
              icon={<Eye className="h-10 w-10" />}
              title="No watchlists yet"
              description="Create your first watchlist to start tracking instruments. AI briefs will use the instruments you track to surface more relevant news."
              actionLabel="Create a watchlist"
              onAction={() => setCreateOpen(true)}
            />
          )}

          {watchlists.isSuccess && watchlists.data.length > 0 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {watchlists.data.map((w) => (
                <WatchlistCard key={w.id} watchlist={w} />
              ))}
            </div>
          )}
        </div>
        <aside className="space-y-6">
          <NewsPanel limit={10} />
        </aside>
      </div>

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Create a watchlist</SheetTitle>
          </SheetHeader>
          <CreateWatchlistForm onSuccess={() => setCreateOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
    </DashboardLayout>
  );
}

function WatchlistsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <SkeletonCard key={i} lines={3} />
      ))}
    </div>
  );
}

function WatchlistCard({ watchlist }: { watchlist: Watchlist }) {
  const del = useDeleteWatchlist();

  const onDelete = async () => {
    if (!confirm(`Delete "${watchlist.name}"? This removes all items on it.`)) return;
    try {
      await del.mutateAsync(watchlist.id);
      toast.success(`"${watchlist.name}" deleted`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not delete");
    }
  };

  return (
    <Card className="group transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="truncate text-base">
            <Link
              to={`/dashboard/markets/watchlists/${watchlist.id}`}
              className="outline-none hover:underline focus-visible:underline"
            >
              {watchlist.name}
            </Link>
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {watchlist.item_count} {watchlist.item_count === 1 ? "instrument" : "instruments"}
          </p>
        </div>
        {watchlist.is_default && (
          <Badge variant="default" className="shrink-0">
            <Star className="mr-0.5 h-3 w-3" aria-hidden="true" />
            Default
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Created {new Date(watchlist.created_at).toLocaleDateString()}</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          disabled={del.isPending}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only">Delete watchlist</span>
        </Button>
      </CardContent>
    </Card>
  );
}

function CreateWatchlistForm({ onSuccess }: { onSuccess: () => void }) {
  const create = useCreateWatchlist();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<WatchlistFormValues>({
    defaultValues: { name: "", is_default: false },
  });

  const isDefault = watch("is_default");

  const onSubmit = handleSubmit(async (v) => {
    const payload: CreateWatchlistInput = {
      name: v.name.trim(),
      is_default: v.is_default,
    };
    try {
      const created = await create.mutateAsync(payload);
      toast.success(`Watchlist "${created.name}" created`);
      reset({ name: "", is_default: false });
      onSuccess();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not create watchlist");
    }
  });

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4" autoComplete="off">
      <div className="space-y-1.5">
        <Label htmlFor="watchlist-name">Name</Label>
        <Input
          id="watchlist-name"
          autoComplete="off"
          placeholder="e.g. Nifty Bank constituents"
          {...register("name", {
            required: "Name is required",
            maxLength: { value: 120, message: "Max 120 chars" },
          })}
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Switch
          checked={isDefault}
          onCheckedChange={(c) => setValue("is_default", Boolean(c))}
        />
        Set as default
      </label>

      {create.isError && (
        <ErrorState
          title="Could not save"
          message={create.error?.message ?? "Unknown error"}
          size="compact"
          onRetry={onSubmit}
        />
      )}

      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" disabled={isSubmitting || create.isPending}>
          {create.isPending ? "Creating…" : "Create watchlist"}
        </Button>
        <Button type="button" variant="ghost" onClick={onSuccess}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
