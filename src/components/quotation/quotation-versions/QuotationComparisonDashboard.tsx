import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Check, Star, TrendingDown, Clock, ShieldCheck, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OptionCharge {
  id: string;
  name: string;
  amount: number;
  rate: number | null;
  currency: string;
}

interface QuoteOption {
  id: string;
  carrier_name: string;
  option_name?: string;
  total_amount: number;
  currency: string;
  transit_time_days: number | null;
  charges?: OptionCharge[];
  charges_total?: number;
  average_rate?: number | null;
  missing_fields?: string[];
  data_completeness?: {
    is_complete: boolean;
    missing_fields: string[];
  };
  reliability_score?: number;
  is_recommended?: boolean;
  rank_score?: number;
  rank_details?: {
    cost_score: number;
    time_score: number;
    reliability_score: number;
  };
}

interface ComparisonDashboardProps {
  options: QuoteOption[];
  onSelect: (optionId: string) => void;
  selectedOptionId?: string | null;
}

const normalizeReliability = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  if (value > 1) return Math.max(0, Math.min(1, value / 100));
  return Math.max(0, Math.min(1, value));
};

const getNumberDeltaLabel = (current: number, baseline: number, suffix: string) => {
  const delta = current - baseline;
  if (delta === 0) return `Same ${suffix}`;
  return `${delta > 0 ? '+' : ''}${delta.toFixed(1)} ${suffix}`;
};

const getIntegrityLabel = (field: string) => {
  const labels: Record<string, string> = {
    option_name: 'Option Name',
    option_amount: 'Option Amount',
    charges: 'Charges',
    charge_amount: 'Charge Amount',
    interest_rates: 'Rates',
  };
  return labels[field] || field;
};

export function QuotationComparisonDashboard({ options, onSelect, selectedOptionId }: ComparisonDashboardProps) {
  const sortedOptions = useMemo(() => {
    return [...options].sort((a, b) => (b.rank_score || 0) - (a.rank_score || 0));
  }, [options]);

  const comparisonExtremes = useMemo(() => {
    const validCosts = options
      .map((option) => Number(option.total_amount))
      .filter((value) => Number.isFinite(value) && value >= 0);
    const validTransitTimes = options
      .map((option) => option.transit_time_days)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
    const validReliability = options
      .map((option) => normalizeReliability(option.reliability_score))
      .filter((value): value is number => value !== null);

    return {
      minCost: validCosts.length ? Math.min(...validCosts) : null,
      minTransit: validTransitTimes.length ? Math.min(...validTransitTimes) : null,
      maxReliability: validReliability.length ? Math.max(...validReliability) : null,
    };
  }, [options]);

  const baselineOption = useMemo(() => {
    if (selectedOptionId) {
      const selected = options.find((option) => option.id === selectedOptionId);
      if (selected) return selected;
    }
    return sortedOptions[0] || null;
  }, [options, selectedOptionId, sortedOptions]);

  const selectedOption = useMemo(() => {
    if (selectedOptionId) {
      const matched = sortedOptions.find((option) => option.id === selectedOptionId);
      if (matched) return matched;
    }
    return sortedOptions[0] || null;
  }, [selectedOptionId, sortedOptions]);

  const dataQualitySummary = useMemo(() => {
    const incompleteOptions = sortedOptions.filter((option) => option.data_completeness?.is_complete === false);
    return {
      incompleteCount: incompleteOptions.length,
      completeCount: sortedOptions.length - incompleteOptions.length,
    };
  }, [sortedOptions]);

  const analysisSummary = useMemo(() => {
    if (!selectedOption || !baselineOption) return null;
    const selectedCost = Number(selectedOption.total_amount || 0);
    const baselineCost = Number(baselineOption.total_amount || 0);
    const selectedTransit = selectedOption.transit_time_days;
    const baselineTransit = baselineOption.transit_time_days;
    const selectedReliability = normalizeReliability(selectedOption.reliability_score);
    const baselineReliability = normalizeReliability(baselineOption.reliability_score);
    const selectedCharges = selectedOption.charges || [];
    const rankedCharges = [...selectedCharges]
      .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
      .slice(0, 5);

    return {
      costDelta: selectedCost - baselineCost,
      transitDelta:
        typeof selectedTransit === 'number' && typeof baselineTransit === 'number'
          ? selectedTransit - baselineTransit
          : null,
      reliabilityDelta:
        selectedReliability !== null && baselineReliability !== null
          ? Number(((selectedReliability - baselineReliability) * 100).toFixed(1))
          : null,
      chargeCount: selectedCharges.length,
      topCharges: rankedCharges,
    };
  }, [baselineOption, selectedOption]);

  if (!options.length) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Option Comparison</h3>
        <Badge variant="outline">{options.length} Options Available</Badge>
      </div>

      {dataQualitySummary.incompleteCount > 0 && (
        <Card className="border-amber-300 bg-amber-50/60" data-testid="comparison-data-quality-alert">
          <CardContent className="p-3">
            <div className="flex items-start gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-700" />
              <div className="space-y-1">
                <p className="font-medium text-amber-900">Comparison data needs attention</p>
                <p className="text-amber-800">
                  {dataQualitySummary.incompleteCount} option(s) have missing fields. {dataQualitySummary.completeCount} option(s) are complete.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <ScrollArea className="w-full whitespace-nowrap rounded-md border">
        <div className="flex w-max space-x-4 p-4">
          {sortedOptions.map((option) => (
            (() => {
              const reliability = normalizeReliability(option.reliability_score);
              const isBestPrice = comparisonExtremes.minCost !== null && option.total_amount === comparisonExtremes.minCost;
              const isFastest = comparisonExtremes.minTransit !== null && option.transit_time_days === comparisonExtremes.minTransit;
              const isMostReliable = comparisonExtremes.maxReliability !== null && reliability === comparisonExtremes.maxReliability;
              const baselineCost = baselineOption ? Number(baselineOption.total_amount) : null;
              const baselineTransit = baselineOption?.transit_time_days ?? null;
              const baselineReliability = baselineOption ? normalizeReliability(baselineOption.reliability_score) : null;
              const currency = option.currency && /^[A-Z]{3}$/.test(option.currency) ? option.currency : 'USD';
              const isSelected = selectedOptionId === option.id;
              const optionDisplayName = option.option_name || `Option #${option.id.slice(0, 4)}`;
              const charges = option.charges || [];
              const rates = charges.map((charge) => charge.rate).filter((rate): rate is number => typeof rate === 'number');
              const averageRate = option.average_rate ?? (rates.length ? rates.reduce((sum, rate) => sum + rate, 0) / rates.length : null);
              const chargesTotal =
                Number.isFinite(Number(option.charges_total)) && Number(option.charges_total) >= 0
                  ? Number(option.charges_total)
                  : charges.reduce((sum, charge) => sum + Number(charge.amount || 0), 0);
              const isComplete = option.data_completeness?.is_complete !== false;

              return (
                <Card
                  key={option.id}
                  data-testid={`comparison-card-${option.id}`}
                  className={cn(
                    'w-[300px] shrink-0 transition-all hover:shadow-md cursor-pointer border-2 relative',
                    isSelected ? 'border-primary bg-primary/5' : 'border-transparent',
                    option.is_recommended && !isSelected ? 'border-amber-400 bg-amber-50/30' : ''
                  )}
                  onClick={() => onSelect(option.id)}
                >
                  {option.is_recommended && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
                      <Star className="w-3 h-3 fill-white" /> Recommended
                    </div>
                  )}

                  <CardHeader className="pb-2 pt-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base font-bold">{option.carrier_name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">{optionDisplayName}</p>
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {isBestPrice && <Badge variant="secondary">Best Price</Badge>}
                          {isFastest && <Badge variant="secondary">Fastest</Badge>}
                          {isMostReliable && <Badge variant="secondary">Most Reliable</Badge>}
                          {!isComplete && <Badge variant="destructive">Incomplete Data</Badge>}
                        </div>
                      </div>
                      {isSelected && (
                        <div className="bg-primary text-primary-foreground rounded-full p-1">
                          <Check className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(option.total_amount || 0))}
                      </span>
                    </div>
                    {baselineCost !== null && baselineOption?.id !== option.id && (
                      <p className="text-xs text-muted-foreground" data-testid={`price-delta-${option.id}`}>
                        {getNumberDeltaLabel(Number(option.total_amount || 0) - baselineCost, 0, currency)}
                      </p>
                    )}

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center py-1 border-b border-dashed">
                        <span className="text-muted-foreground">Option Amount</span>
                        <span className="font-medium">
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(option.total_amount || 0))}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-dashed">
                        <span className="text-muted-foreground">Average Rate</span>
                        <span className="font-medium" data-testid={`average-rate-${option.id}`}>
                          {averageRate !== null ? averageRate.toFixed(2) : 'N/A'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-dashed">
                        <span className="text-muted-foreground">Charges</span>
                        <span className="font-medium" data-testid={`charges-count-${option.id}`}>{charges.length}</span>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-dashed">
                        <span className="text-muted-foreground">Charges Total</span>
                        <span className="font-medium" data-testid={`charges-total-${option.id}`}>
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(chargesTotal)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-dashed">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="w-4 h-4" /> Transit Time
                        </span>
                        <span className="font-medium">{option.transit_time_days || 'TBD'} days</span>
                      </div>
                      {baselineTransit && option.transit_time_days && baselineOption?.id !== option.id && (
                        <p className="text-xs text-muted-foreground" data-testid={`transit-delta-${option.id}`}>
                          {getNumberDeltaLabel(option.transit_time_days - baselineTransit, 0, 'days')}
                        </p>
                      )}

                      <div className="flex justify-between items-center py-1 border-b border-dashed">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <ShieldCheck className="w-4 h-4" /> Reliability
                        </span>
                        <span
                          className={cn(
                            'font-medium',
                            (reliability || 0) > 0.8 ? 'text-green-600' : 'text-amber-600'
                          )}
                        >
                          {reliability !== null ? `${Math.round(reliability * 100)}%` : 'N/A'}
                        </span>
                      </div>
                      {baselineReliability !== null && reliability !== null && baselineOption?.id !== option.id && (
                        <p className="text-xs text-muted-foreground" data-testid={`reliability-delta-${option.id}`}>
                          {getNumberDeltaLabel((reliability - baselineReliability) * 100, 0, 'pts')}
                        </p>
                      )}

                      <div className="flex justify-between items-center py-1">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <TrendingDown className="w-4 h-4" /> Rank Score
                        </span>
                        <Badge variant="secondary">{option.rank_score?.toFixed(1) || '0.0'}</Badge>
                      </div>

                      {option.rank_details && (
                        <div className="pt-2 text-xs grid grid-cols-3 gap-1">
                          <div className="text-center bg-muted p-1 rounded">
                            <div className="text-muted-foreground">Cost</div>
                            <div className="font-bold">{option.rank_details.cost_score}</div>
                          </div>
                          <div className="text-center bg-muted p-1 rounded">
                            <div className="text-muted-foreground">Time</div>
                            <div className="font-bold">{option.rank_details.time_score}</div>
                          </div>
                          <div className="text-center bg-muted p-1 rounded">
                            <div className="text-muted-foreground">Rel</div>
                            <div className="font-bold">{option.rank_details.reliability_score}</div>
                          </div>
                        </div>
                      )}

                      {!isComplete && option.data_completeness?.missing_fields && option.data_completeness.missing_fields.length > 0 && (
                        <div className="pt-1 text-xs text-destructive space-y-1" data-testid={`missing-fields-${option.id}`}>
                          {option.data_completeness.missing_fields.map((field) => (
                            <div key={field}>{getIntegrityLabel(field)} missing</div>
                          ))}
                        </div>
                      )}
                    </div>

                    <Button
                      className="w-full mt-2"
                      variant={isSelected ? 'default' : 'outline'}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(option.id);
                      }}
                    >
                      {isSelected ? 'Selected' : 'Select Option'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })()
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {selectedOption && analysisSummary && (
        <Card data-testid="comparison-detailed-analysis">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Detailed Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Cost Delta</div>
                <div className="text-sm font-semibold">
                  {getNumberDeltaLabel(analysisSummary.costDelta, 0, selectedOption.currency || 'USD')}
                </div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Transit Delta</div>
                <div className="text-sm font-semibold">
                  {analysisSummary.transitDelta !== null ? getNumberDeltaLabel(analysisSummary.transitDelta, 0, 'days') : 'N/A'}
                </div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Reliability Delta</div>
                <div className="text-sm font-semibold">
                  {analysisSummary.reliabilityDelta !== null ? getNumberDeltaLabel(analysisSummary.reliabilityDelta, 0, 'pts') : 'N/A'}
                </div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Charge Lines</div>
                <div className="text-sm font-semibold">{analysisSummary.chargeCount}</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Top Charges</div>
              {analysisSummary.topCharges.length > 0 ? (
                <div className="space-y-2">
                  {analysisSummary.topCharges.map((charge) => (
                    <div
                      key={charge.id}
                      className="flex flex-col gap-1 rounded-md border p-2 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="text-sm">{charge.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Rate: {typeof charge.rate === 'number' ? charge.rate.toFixed(2) : 'N/A'}
                      </div>
                      <div className="text-sm font-medium">
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: charge.currency || selectedOption.currency || 'USD',
                        }).format(Number(charge.amount || 0))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No charge details available for this option.</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
