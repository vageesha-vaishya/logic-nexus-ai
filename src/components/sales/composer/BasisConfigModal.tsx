import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface BasisConfig {
  tradeDirection: string;
  containerType: string;
  containerSize: string;
  quantity: number;
}

interface BasisConfigModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (config: BasisConfig) => void;
  config: BasisConfig;
  onChange: (updates: Partial<BasisConfig>) => void;
  tradeDirections: any[];
  containerTypes: any[];
  containerSizes: any[];
}

export function BasisConfigModal({
  open,
  onClose,
  onSave,
  config,
  onChange,
  tradeDirections,
  containerTypes,
  containerSizes
}: BasisConfigModalProps) {
  const handleSave = () => {
    const finalTradeDirection = config.tradeDirection || String(tradeDirections[0]?.id || '');
    const finalContainerType = config.containerType || String(containerTypes[0]?.id || '');
    const finalContainerSize = config.containerSize || String(containerSizes[0]?.id || '');
    const finalQuantity = Math.max(1, Number(config.quantity || 1));

    if (!finalContainerSize) {
      alert('Please fill all required fields');
      return;
    }

    onSave({
      tradeDirection: finalTradeDirection,
      containerType: finalContainerType,
      containerSize: finalContainerSize,
      quantity: finalQuantity,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
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
              {containerSizes.map((cs) => (
                <ToggleGroupItem key={cs.id} value={String(cs.id)} variant="outline" size="lg" className="justify-start">
                  {cs.name}
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
