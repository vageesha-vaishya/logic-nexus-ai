import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { formatContainerSize } from '@/lib/container-utils';
import { useQuoteStore } from './store/QuoteStore';

export function BasisConfigModal() {
  const { state, dispatch } = useQuoteStore();
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

  const onClose = () => dispatch({ type: 'CLOSE_BASIS_MODAL' });
  
  const onChange = (updates: any) => {
    dispatch({ type: 'UPDATE_BASIS_CONFIG', payload: updates });
  };

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

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Container Basis Configuration</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
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
          </div>

          <div className="space-y-2">
            <Label>Number of Containers</Label>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onChange({ quantity: Math.max(1, (config.quantity || 1) - 1) })}>-</Button>
              <Input className="w-20 text-center" type="number" value={config.quantity} onChange={(e) => onChange({ quantity: Math.max(1, Number(e.target.value) || 1) })} min={1} />
              <Button type="button" variant="outline" size="sm" onClick={() => onChange({ quantity: (config.quantity || 1) + 1 })}>+</Button>
            </div>
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
