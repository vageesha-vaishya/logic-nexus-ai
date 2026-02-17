import { useEffect, useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useCarriersByMode } from '@/hooks/useCarriersByMode';
import { normalizeModeCode } from '@/lib/mode-utils';

interface CarrierSelectProps {
  mode?: string | null;
  value?: string | null;
  onChange: (carrierId: string | null, carrierName?: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  showPreferred?: boolean;
  clearable?: boolean;
}

export function CarrierSelect({
  mode,
  value,
  onChange,
  placeholder = 'Select carrier',
  disabled,
  showPreferred = true,
  clearable = true,
}: CarrierSelectProps) {
  const { getCarriersForMode, isLoading } = useCarriersByMode();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(timer);
  }, [search]);

  const normalizedMode = normalizeModeCode(mode || '');
  const baseCarriers = useMemo(
    () => (normalizedMode ? getCarriersForMode(normalizedMode) : []),
    [normalizedMode, getCarriersForMode]
  );

  const showSearch = baseCarriers.length >= 8;

  const filteredCarriers = useMemo(() => {
    if (!debouncedSearch) return baseCarriers;
    const q = debouncedSearch.toLowerCase();
    return baseCarriers.filter((c) => {
      const name = (c.carrier_name || '').toLowerCase();
      const scac = (c.scac || '').toLowerCase();
      const iata = (c.iata || '').toLowerCase();
      const code = (c.carrier_code || '').toLowerCase();
      const mcDot = (c.mc_dot || '').toLowerCase();
      return (
        name.includes(q) ||
        scac.includes(q) ||
        iata.includes(q) ||
        code.includes(q) ||
        mcDot.includes(q)
      );
    });
  }, [baseCarriers, debouncedSearch]);

  const preferredCarriers = useMemo(
    () => (showPreferred ? filteredCarriers.filter((c) => c.is_preferred) : []),
    [filteredCarriers, showPreferred]
  );

  const otherCarriers = useMemo(
    () =>
      showPreferred
        ? filteredCarriers.filter((c) => !c.is_preferred)
        : filteredCarriers,
    [filteredCarriers, showPreferred]
  );

  const currentCarrier = useMemo(
    () => filteredCarriers.find((c) => c.id === value) || null,
    [filteredCarriers, value]
  );

  const displayLabel =
    currentCarrier?.carrier_name || (value ? 'Loading carrier...' : '');

  const handleChange = (carrierId: string) => {
    if (carrierId === '__clear') {
      onChange(null, null);
      return;
    }
    const carrier = filteredCarriers.find((c) => c.id === carrierId) || null;
    onChange(carrierId, carrier?.carrier_name || null);
  };

  const renderHighlighted = (text: string) => {
    if (!debouncedSearch) return text;
    const lower = text.toLowerCase();
    const q = debouncedSearch.toLowerCase();
    const idx = lower.indexOf(q);
    if (idx === -1) return text;
    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + q.length);
    const after = text.slice(idx + q.length);
    return (
      <>
        {before}
        <span className="font-semibold">{match}</span>
        {after}
      </>
    );
  };

  return (
    <div className="space-y-1">
      <Select onValueChange={handleChange} value={value || ''} disabled={disabled || !normalizedMode}>
        <SelectTrigger className="h-9 bg-background">
          <SelectValue placeholder={placeholder}>
            {displayLabel || placeholder}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {showSearch && (
            <div className="px-2 py-1">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search carriers..."
                className="h-8 text-xs"
              />
            </div>
          )}
          {isLoading && (
            <SelectItem value="__loading" disabled>
              Loading carriers...
            </SelectItem>
          )}
          {!isLoading && baseCarriers.length === 0 && (
            <SelectItem value="__empty" disabled>
              No carriers available for this mode.
            </SelectItem>
          )}
          {!isLoading && baseCarriers.length > 0 && clearable && value && (
            <SelectItem value="__clear">
              Clear selection
            </SelectItem>
          )}
          {!isLoading && preferredCarriers.length > 0 && (
            <>
              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">
                Preferred Carriers
              </div>
              {preferredCarriers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm">
                      {renderHighlighted(c.carrier_name || '')}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {c.scac || c.iata || c.carrier_code || c.mc_dot || ''}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </>
          )}
          {!isLoading && otherCarriers.length > 0 && (
            <>
              {preferredCarriers.length > 0 && (
                <div className="px-2 pt-2 pb-1 text-[10px] font-semibold text-muted-foreground uppercase">
                  All Carriers
                </div>
              )}
              {otherCarriers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm">
                      {renderHighlighted(c.carrier_name || '')}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {c.scac || c.iata || c.carrier_code || c.mc_dot || ''}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
