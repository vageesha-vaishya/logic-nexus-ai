import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { formatContainerSize } from '@/lib/container-utils';
import { useQuoteStore } from './store/QuoteStore';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useEffect, useMemo, useState } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { Badge } from '@/components/ui/badge';

export function BasisConfigModal() {
  const { state, dispatch } = useQuoteStore();
  const { scopedDb, context } = useCRM();
  const { 
    isOpen, 
    config, 
    target 
  } = state.basisModal;
  
  const {
    tradeDirections,
    containerTypes,
    containerSizes
  } = state.referenceData;
  const quoteData = state.quoteData || {};
  const leg = target?.type === 'leg' ? state.legs.find(l => l.id === target.legId) : null;
  const tenantId = state.tenantId || 'global';
  const franchiseId = state.franchiseId || null;
  const [franchiseDefaultsApplied, setFranchiseDefaultsApplied] = useState(false);
  const [franchiseDefaultsFields, setFranchiseDefaultsFields] = useState<string[]>([]);

  const onClose = () => dispatch({ type: 'CLOSE_BASIS_MODAL' });
  
  const onChange = (updates: any) => {
    dispatch({ type: 'UPDATE_BASIS_CONFIG', payload: updates });
  };

  useEffect(() => {
    if (!isOpen) return;
    const updates: any = {};
    try {
      const saved = localStorage.getItem(`basis:last:${tenantId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.tradeDirection && !config.tradeDirection) updates.tradeDirection = String(parsed.tradeDirection);
        if (parsed.containerType && !config.containerType) updates.containerType = String(parsed.containerType);
        if (parsed.containerSize && !config.containerSize) updates.containerSize = String(parsed.containerSize);
        if (parsed.quantity && (!config.quantity || config.quantity < 1)) updates.quantity = Math.max(1, Number(parsed.quantity));
      }
    } catch {
      void 0;
    }
    if (!config.tradeDirection) {
      const td = String(quoteData.trade_direction_id || tradeDirections[0]?.id || '');
      if (td) updates.tradeDirection = td;
    }
    if (!config.containerType) {
      const defaultType = String(quoteData.container_type_id || containerTypes[0]?.id || '');
      if (defaultType) updates.containerType = defaultType;
    }
    if (!config.containerSize) {
      const sizeByName = (namePart: string) => containerSizes.find((cs: any) => String(cs.name).toLowerCase().includes(namePart));
      const oceanPreferred = leg?.mode === 'ocean';
      const preferred = oceanPreferred ? (sizeByName('40hc') || sizeByName('40hq') || sizeByName('40') || sizeByName('20')) : null;
      const fallback = containerSizes.find((cs: any) => !config.containerType || cs.type_id === config.containerType) || containerSizes[0];
      const chosen = preferred || fallback;
      if (chosen?.id) updates.containerSize = String(chosen.id);
    }
    if (!config.quantity || config.quantity < 1) {
      updates.quantity = Math.max(1, Number(quoteData.container_count || 1));
    }
    if (Object.keys(updates).length > 0) {
      onChange(updates);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setFranchiseDefaultsApplied(false);
      setFranchiseDefaultsFields([]);
      return;
    }
    if (!isOpen) return;
    (async () => {
      try {
        const { data, error } = await scopedDb
          .from('basis_preferences')
          .select('config')
          .eq('tenant_id', context?.tenantId)
          .eq('franchise_id', context?.franchiseId ?? null)
          .maybeSingle();
        if (error && error.code !== 'PGRST116') return;
        const saved = (data as any)?.config;
        if (saved) {
          const updates: any = {};
          const applied: string[] = [];
          if (saved.tradeDirection && !config.tradeDirection) updates.tradeDirection = String(saved.tradeDirection);
          if (updates.tradeDirection) applied.push('Trade Direction');
          if (saved.containerType && !config.containerType) updates.containerType = String(saved.containerType);
          if (updates.containerType) applied.push('Container Type');
          if (saved.containerSize && !config.containerSize) updates.containerSize = String(saved.containerSize);
          if (updates.containerSize) applied.push('Container Size');
          if (saved.quantity && (!config.quantity || config.quantity < 1)) updates.quantity = Math.max(1, Number(saved.quantity));
          if (updates.quantity) applied.push('Quantity');
          if (Object.keys(updates).length > 0) {
            setFranchiseDefaultsApplied(true);
            setFranchiseDefaultsFields(applied);
            onChange(updates);
          }
        }
      } catch {
        // ignore
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, scopedDb, context?.tenantId, context?.franchiseId]);

  const recommendedSizes = useMemo(() => {
    const byText = (txt: string) => containerSizes.find((cs: any) => String(cs.name).toLowerCase().includes(txt));
    const list = [byText('20'), byText('40'), byText('40hc') || byText('40hq')].filter(Boolean) as any[];
    return list.filter((cs: any) => !config.containerType || cs.type_id === config.containerType);
  }, [containerSizes, config.containerType]);

  const sizeMatchesType = useMemo(() => {
    const selected = containerSizes.find((cs: any) => String(cs.id) === String(config.containerSize));
    if (!selected) return true;
    if (!config.containerType) return true;
    return String(selected.type_id) === String(config.containerType);
  }, [containerSizes, config.containerSize, config.containerType]);

  const handleSave = () => {
    if (!target) return;

    const finalTradeDirection = config.tradeDirection || String(tradeDirections[0]?.id || '');
    const finalContainerType = config.containerType || String(containerTypes[0]?.id || '');
    const finalContainerSize = config.containerSize || String(containerSizes[0]?.id || '');
    const finalQuantity = Math.max(1, Number(config.quantity || 1));

    if (!finalContainerSize) {
      alert('Please fill all required fields');
      return;
    }

    const size = containerSizes.find(s => s.id === finalContainerSize);
    const sizeName = size ? formatContainerSize(size.name) : '';
    
    // Create the updated config object
    const basisConfig = {
      tradeDirection: finalTradeDirection,
      containerType: finalContainerType,
      containerSize: finalContainerSize,
      quantity: finalQuantity,
    };

    if (target.type === 'leg' && target.legId) {
      const { legId, chargeIdx } = target;
      const leg = state.legs.find(l => l.id === legId);
      
      if (leg && leg.charges[chargeIdx]) {
        const charges = [...leg.charges];
        charges[chargeIdx] = {
          ...charges[chargeIdx],
          unit: `${finalQuantity}x${sizeName}`,
          buy: { ...charges[chargeIdx].buy, quantity: finalQuantity },
          sell: { ...charges[chargeIdx].sell, quantity: finalQuantity },
          basisDetails: basisConfig
        };
        dispatch({ type: 'UPDATE_LEG', payload: { id: legId, updates: { charges } } });
      }
    } else if (target.type === 'combined') {
      const { chargeIdx } = target;
      const currentCharge = state.charges[chargeIdx];
      
      if (currentCharge) {
        const updatedCharge = {
          ...currentCharge,
          unit: `${finalQuantity}x${sizeName}`,
          buy: { ...(currentCharge.buy || {}), quantity: finalQuantity },
          sell: { ...(currentCharge.sell || {}), quantity: finalQuantity },
          basisDetails: basisConfig
        };
        dispatch({ type: 'UPDATE_COMBINED_CHARGE', payload: { index: chargeIdx, charge: updatedCharge } });
      }
    }

    try {
      localStorage.setItem(`basis:last:${tenantId}`, JSON.stringify(basisConfig));
    } catch {
      void 0;
    }
    (async () => {
      try {
        if (!context?.tenantId) return;
        const payload: any = {
          tenant_id: context.tenantId,
          franchise_id: context?.franchiseId ?? null,
          config: basisConfig,
          updated_at: new Date().toISOString(),
        };
        await scopedDb
          .from('basis_preferences')
          .upsert(payload, { onConflict: 'tenant_id,franchise_id' });
      } catch {
        // ignore if table missing or RLS prevents write
      }
    })();

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Container Basis Configuration
            {franchiseDefaultsApplied && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-blue-500 text-blue-600 bg-blue-50">
                      Defaulted from franchise
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <div className="text-xs space-y-1">
                      <div className="font-medium">Defaults applied from franchise</div>
                      {franchiseDefaultsFields.length > 0 && (
                        <div className="text-muted-foreground">
                          {franchiseDefaultsFields.join(', ')}
                        </div>
                      )}
                      {franchiseId && (
                        <div className="text-muted-foreground">Franchise: {franchiseId}</div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Quick Presets</Label>
            <div className="flex flex-wrap gap-2">
              {recommendedSizes.map((cs: any) => (
                <Button
                  key={cs.id}
                  type="button"
                  variant={String(config.containerSize) === String(cs.id) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onChange({ containerSize: String(cs.id) })}
                >
                  {formatContainerSize(cs.name)}
                </Button>
              ))}
              <div className="ml-2 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Qty:</span>
                {[1, 2, 4].map((q) => (
                  <Button
                    key={q}
                    type="button"
                    variant={Number(config.quantity || 1) === q ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onChange({ quantity: q })}
                  >
                    {q}
                  </Button>
                ))}
              </div>
            </div>
            {leg && leg.mode !== 'ocean' && (
              <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                Container basis is typically used for Ocean (FCL). Ensure this matches the charge’s basis for {leg.mode.toUpperCase()}.
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Basis Templates</Label>
            <div className="flex flex-wrap items-center gap-2">
              {leg?.mode === 'air' && (
                <>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button type="button" variant="outline" size="sm">Air: per kg</Button>
                      </TooltipTrigger>
                      <TooltipContent>Use weight-based basis for air freight</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onChange({ quantity: Math.max(1, Number(quoteData.total_weight || 1)) })}
                  >
                    Use quote weight
                  </Button>
                </>
              )}
              {leg?.mode === 'ocean' && (
                <>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button type="button" variant="outline" size="sm">LCL: per cbm</Button>
                      </TooltipTrigger>
                      <TooltipContent>Use volume-based basis for LCL shipments</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onChange({ quantity: Math.max(1, Number(quoteData.total_volume || 1)) })}
                  >
                    Use quote volume
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Trade Direction *</Label>
            <ToggleGroup type="single" value={config.tradeDirection} onValueChange={(val) => onChange({ tradeDirection: String(val || '') })} className="flex flex-wrap gap-2">
              {tradeDirections.map((d) => (
                <ToggleGroupItem key={d.id} value={String(d.id)} variant="outline" size="lg" className="min-w-[140px]">{d.name}</ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="space-y-2">
            <Label>Container Type *</Label>
            <ToggleGroup type="single" value={config.containerType} onValueChange={(val) => onChange({ containerType: String(val || '') })} className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {containerTypes.map((ct) => (
                <ToggleGroupItem key={ct.id} value={String(ct.id)} variant="outline" size="lg" className="justify-start">
                  {ct.name}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="space-y-2">
            <Label>Container Size *</Label>
            <ToggleGroup type="single" value={config.containerSize} onValueChange={(val) => onChange({ containerSize: String(val || '') })} className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {containerSizes
                .filter(cs => !config.containerType || cs.type_id === config.containerType)
                .map((cs) => (
                <ToggleGroupItem key={cs.id} value={String(cs.id)} variant="outline" size="lg" className="justify-start">
                  {formatContainerSize(cs.name)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {!sizeMatchesType && (
              <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                Selected size does not belong to the chosen container type.
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Number of Containers</Label>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onChange({ quantity: Math.max(1, (config.quantity || 1) - 1) })}>-</Button>
              <Input className="w-20 text-center" type="number" value={config.quantity} onChange={(e) => onChange({ quantity: Math.max(1, Number(e.target.value) || 1) })} min={1} />
              <Button type="button" variant="outline" size="sm" onClick={() => onChange({ quantity: (config.quantity || 1) + 1 })}>+</Button>
            </div>
            {Number(config.quantity || 1) < 1 && (
              <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                Quantity must be at least 1.
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Configuration</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
