import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Link2, Loader2, Pencil, Unlink2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/utils';

import { usePortfolios } from '../../hooks/usePortfolios';
import { usePortfolioPnL } from '../../hooks/usePortfolioPnL';
import { usePortfolioTiers, useUpsertPortfolioTier } from '../hooks/usePortfolioTiers';
import { TIER_DEFAULTS, type PortfolioTier } from '../types';
import { GoalProgressAnchor } from './GoalProgressAnchor';

function tierBlurb(tierNumber: 1 | 2 | 3): string {
  return TIER_DEFAULTS.find((d) => d.tier_number === tierNumber)?.description ?? '';
}

/** Radix Select rejects empty-string values; sentinel for the "Unlink" choice. */
const UNLINK_VALUE = '__unlink__';

/**
 * Inline picker that handles all three transitions: link (empty → set),
 * change (set → set'), and unlink (set → null). `onCancel` only appears
 * when invoked from "Change portfolio" — initial linking has nothing to
 * cancel back to.
 */
function PortfolioPicker({
  tier,
  showUnlinkOption,
  onCancel,
}: {
  tier: PortfolioTier;
  showUnlinkOption: boolean;
  onCancel?: () => void;
}) {
  const { data: portfolios = [], isLoading: portfoliosLoading } = usePortfolios();
  const upsertTier = useUpsertPortfolioTier();

  const handleChoose = (value: string) => {
    upsertTier.mutate(
      {
        tier_number:  tier.tier_number,
        name:         tier.name,
        portfolio_id: value === UNLINK_VALUE ? null : value,
      },
      { onSuccess: () => onCancel?.() },
    );
  };

  if (portfoliosLoading) {
    return (
      <div className="flex items-center gap-2 rounded-md border p-3 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading portfolios…
      </div>
    );
  }

  if (portfolios.length === 0) {
    return (
      <div className="space-y-2 rounded-md border border-dashed p-3 text-xs">
        <p className="text-muted-foreground">
          No portfolios yet. Create one first, then link it here.
        </p>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline" className="h-7 text-xs">
            <Link to="/dashboard/markets/portfolios">Create portfolio</Link>
          </Button>
          {onCancel && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    );
  }

  const currentValue = tier.portfolio_id ?? '';

  return (
    <div className="space-y-2 rounded-md border p-3">
      <Select
        value={currentValue || undefined}
        onValueChange={handleChoose}
        disabled={upsertTier.isPending}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Pick a portfolio…" />
        </SelectTrigger>
        <SelectContent>
          {portfolios.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
          {showUnlinkOption && (
            <SelectItem value={UNLINK_VALUE} className="text-rose-600">
              Unlink (none)
            </SelectItem>
          )}
        </SelectContent>
      </Select>
      <div className="flex items-center justify-between">
        {upsertTier.isPending ? (
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving…
          </span>
        ) : upsertTier.isError ? (
          <span className="text-[11px] text-rose-600">
            {upsertTier.error instanceof Error
              ? upsertTier.error.message
              : 'Save failed — try again.'}
          </span>
        ) : (
          <span />
        )}
        {onCancel && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px]"
            onClick={onCancel}
            disabled={upsertTier.isPending}
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * "Link a portfolio to this tier" CTA. Click → expands to PortfolioPicker.
 * (No unlink option since nothing is linked yet.)
 */
function LinkPortfolioInline({ tier }: { tier: PortfolioTier }) {
  const [isLinking, setIsLinking] = useState(false);

  if (!isLinking) {
    return (
      <button
        type="button"
        onClick={() => setIsLinking(true)}
        className="flex w-full items-center gap-2 rounded-md border border-dashed p-3 text-left text-sm text-muted-foreground hover:bg-muted/40"
      >
        <Link2 className="h-4 w-4" />
        <span>Link a portfolio to this tier</span>
      </button>
    );
  }

  return (
    <PortfolioPicker
      tier={tier}
      showUnlinkOption={false}
      onCancel={() => setIsLinking(false)}
    />
  );
}

/**
 * Footer affordances on a *linked* tier — "Change portfolio" toggles the
 * picker open (with Unlink as a choice), "Unlink" is a one-tap shortcut.
 */
function LinkedTierActions({
  tier,
  onStartEdit,
}: {
  tier: PortfolioTier;
  onStartEdit: () => void;
}) {
  const upsertTier = useUpsertPortfolioTier();

  const handleUnlink = () => {
    upsertTier.mutate({
      tier_number:  tier.tier_number,
      name:         tier.name,
      portfolio_id: null,
    });
  };

  return (
    <div className="flex items-center justify-end gap-1 pt-1">
      <Button
        size="sm"
        variant="ghost"
        className="h-6 px-2 text-[11px] text-muted-foreground"
        onClick={onStartEdit}
        disabled={upsertTier.isPending}
      >
        <Pencil className="mr-1 h-3 w-3" />
        Change
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 px-2 text-[11px] text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40"
        onClick={handleUnlink}
        disabled={upsertTier.isPending}
      >
        {upsertTier.isPending ? (
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        ) : (
          <Unlink2 className="mr-1 h-3 w-3" />
        )}
        Unlink
      </Button>
    </div>
  );
}

function TierCard({ tier }: { tier: PortfolioTier }) {
  // Hook always called — usePortfolioPnL gates fetch on truthy portfolio_id.
  const pnl     = usePortfolioPnL(tier.portfolio_id ?? undefined, 365);
  const summary = pnl.data?.summary;

  const pnlPositive = summary ? summary.total_pnl >= 0 : true;
  const [isEditing, setIsEditing] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">{tier.name}</CardTitle>
            <p className="text-xs text-muted-foreground">{tierBlurb(tier.tier_number)}</p>
          </div>
          {summary && (
            <Badge
              variant={pnlPositive ? 'default' : 'destructive'}
              className="text-xs shrink-0"
            >
              {`${summary.pnl_pct >= 0 ? '+' : ''}${summary.pnl_pct.toFixed(1)}%`}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {!tier.portfolio_id ? (
          <LinkPortfolioInline tier={tier} />
        ) : isEditing ? (
          <PortfolioPicker
            tier={tier}
            showUnlinkOption
            onCancel={() => setIsEditing(false)}
          />
        ) : pnl.isLoading ? (
          <p className="text-xs text-muted-foreground">Loading P&amp;L…</p>
        ) : pnl.isError ? (
          <>
            <p className="text-xs text-rose-600">
              Unable to load this tier&apos;s performance.
            </p>
            <LinkedTierActions tier={tier} onStartEdit={() => setIsEditing(true)} />
          </>
        ) : summary ? (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Current value</span>
              <span className="font-semibold tabular-nums">
                {formatCurrency(summary.current_nav, 'INR', { minimumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total P&amp;L</span>
              <span
                className={`tabular-nums ${pnlPositive ? 'text-emerald-600' : 'text-rose-500'}`}
              >
                {formatCurrency(summary.total_pnl, 'INR', { minimumFractionDigits: 0 })}
              </span>
            </div>
            {tier.target_amount != null && tier.target_amount > 0 && (
              <GoalProgressAnchor
                currentValue={summary.current_nav}
                targetValue={tier.target_amount}
                goalLabel={tier.goals[0] ?? tier.name}
                targetYear={new Date().getFullYear() + 10}
              />
            )}
            <LinkedTierActions tier={tier} onStartEdit={() => setIsEditing(true)} />
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              No transactions yet for this tier.
            </p>
            <LinkedTierActions tier={tier} onStartEdit={() => setIsEditing(true)} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function PortfolioTierView() {
  const { data: tiers = [], isLoading, isError } = usePortfolioTiers();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading tiers…</p>;
  }
  if (isError) {
    return <p className="text-sm text-rose-600">Unable to load tiers.</p>;
  }
  if (tiers.length === 0) {
    return null;
  }

  const defaultTab = String(tiers[0].tier_number);

  return (
    <Tabs defaultValue={defaultTab} className="space-y-4">
      <TabsList className="w-full">
        {tiers.map((t) => (
          <TabsTrigger
            key={t.tier_number}
            value={String(t.tier_number)}
            className="flex-1 text-xs"
          >
            {t.name}
          </TabsTrigger>
        ))}
      </TabsList>
      {tiers.map((t) => (
        <TabsContent key={t.tier_number} value={String(t.tier_number)}>
          <TierCard tier={t} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
