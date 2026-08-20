import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { getModeIcon } from '@/components/quotation/shared/quote-badges';
import { mapLegsForVisualizer } from '@/lib/quote-legs';
import { formatCurrency } from '@/lib/utils';
import { formatContainerSize } from '@/lib/container-utils';
import { RateOption } from '@/types/quote-breakdown';

export interface SmartQuoteRateCardProps {
  option: RateOption;
  isSelected: boolean;
  onToggleSelection: () => void;
  onSelect: () => void;
  onViewDetails: () => void;
}

const TIER_LABELS: Record<string, string> = {
  contract: 'Contract',
  spot: 'Spot',
  best_value: 'Best Value',
  cheapest: 'Cheapest',
  fastest: 'Fastest',
  greenest: 'Greenest',
  reliable: 'Reliable',
};

function tierLabel(tier?: string): string | null {
  if (!tier) return null;
  return TIER_LABELS[tier] || tier.replace(/_/g, ' ');
}

function sourceBadge(option: RateOption): { label: string; tone: 'tide' | 'neutral' } {
  const source = option.source_attribution || '';
  if (source.includes('AI')) return { label: 'AI Generated', tone: 'tide' };
  if (option.is_manual || source.includes('Manual')) return { label: 'Manual', tone: 'neutral' };
  return { label: 'Market Rate', tone: 'neutral' };
}

function reliabilityTone(score: number): string {
  if (score >= 9) return 'var(--sq-good)';
  if (score >= 7) return 'var(--sq-tide)';
  if (score >= 5) return 'var(--sq-accent)';
  return 'var(--sq-rust)';
}

export function SmartQuoteRateCard({ option, isSelected, onToggleSelection, onSelect, onViewDetails }: SmartQuoteRateCardProps) {
  const tier = tierLabel(option.tier);
  const source = sourceBadge(option);
  const legs = option.legs && option.legs.length > 0
    ? mapLegsForVisualizer(option.legs, { origin: (option as any).origin, destination: (option as any).destination })
    : [];
  const carrierName = option.carrier || option.name || 'Unknown Carrier';

  return (
    <div
      data-testid={`smart-quote-rate-card-${option.id}`}
      data-selected={isSelected}
      className="flex flex-col gap-3 rounded-lg border p-4 transition-colors"
      style={{
        borderColor: isSelected ? 'var(--sq-accent)' : 'var(--sq-border)',
        background: 'var(--sq-bg)',
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Checkbox checked={isSelected} onCheckedChange={onToggleSelection} aria-label={`Select ${carrierName}`} />
        <span style={{ color: 'var(--sq-ink)' }}>{getModeIcon(option.transport_mode || 'ocean')}</span>
        <span className="font-semibold" style={{ fontFamily: 'var(--sq-font-body)', color: 'var(--sq-ink)' }}>
          {carrierName}
        </span>
        {tier && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{ background: 'var(--sq-accent)', color: 'var(--sq-accent-ink)' }}
          >
            {tier}
          </span>
        )}
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{
            background: source.tone === 'tide' ? 'var(--sq-tide)' : 'var(--sq-border)',
            color: source.tone === 'tide' ? 'var(--sq-accent-ink)' : 'var(--sq-ink)',
          }}
        >
          {source.label}
        </span>
      </div>

      {option.name && (
        <p className="truncate text-sm" style={{ color: 'var(--sq-ink)', opacity: 0.7 }}>
          {formatContainerSize(option.name)}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 text-sm" style={{ color: 'var(--sq-ink)' }}>
        <span style={{ fontFamily: 'var(--sq-font-mono)' }}>{option.transitTime || '—'}</span>
        {option.verified && (
          <span style={{ color: 'var(--sq-good)' }}>
            Verified
            {option.verificationTimestamp
              ? ` ${new Date(option.verificationTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : ''}
          </span>
        )}
      </div>

      {legs.length > 0 && (
        <div aria-label="Route" role="img" className="flex items-center gap-1">
          {legs.map((leg, i) => (
            <span
              key={i}
              title={`${leg.from} → ${leg.to}`}
              className="h-2 w-2 rounded-full"
              style={{ background: 'var(--sq-tide)' }}
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs">
        {option.reliability && (
          <span style={{ color: reliabilityTone(option.reliability.score) }}>
            Reliability {option.reliability.score}/10
          </span>
        )}
        {(option.co2_kg || option.environmental) && (
          <span style={{ color: 'var(--sq-good)' }}>
            {option.co2_kg ? `${option.co2_kg} kg CO2` : option.environmental?.co2_emissions}
          </span>
        )}
      </div>

      {option.ai_explanation && (
        <p
          className="rounded-md p-2 text-xs"
          style={{ background: 'color-mix(in srgb, var(--sq-tide) 12%, transparent)', color: 'var(--sq-tide)' }}
        >
          {option.ai_explanation}
        </p>
      )}

      <div className="flex items-baseline gap-3" style={{ fontFamily: 'var(--sq-font-mono)' }}>
        <span className="text-xl font-semibold" style={{ color: 'var(--sq-ink)', fontVariantNumeric: 'tabular-nums' }}>
          {formatCurrency(option.price, option.currency)}
        </span>
        {option.markupPercent !== undefined && (
          <span className="text-xs" style={{ color: 'var(--sq-good)' }}>
            {option.markupPercent}% mkp
          </span>
        )}
        {option.marginAmount !== undefined && (
          <span className="text-xs" style={{ color: 'var(--sq-good)' }}>
            +{formatCurrency(option.marginAmount, option.currency)}
          </span>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onViewDetails}>
          Details
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onSelect}
          style={{ background: 'var(--sq-accent)', color: 'var(--sq-accent-ink)' }}
        >
          Select
        </Button>
      </div>
    </div>
  );
}
