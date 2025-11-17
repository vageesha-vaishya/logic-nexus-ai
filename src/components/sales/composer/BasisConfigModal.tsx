import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
    if (!config.tradeDirection || !config.containerType || !config.containerSize) {
      alert('Please fill all required fields');
      return;
    }
    onSave(config);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configure Charge Basis</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label>Trade Direction *</Label>
            <Select
              value={config.tradeDirection}
              onValueChange={(val) => onChange({ tradeDirection: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select direction" />
              </SelectTrigger>
              <SelectContent>
                {tradeDirections.map((dir) => (
                  <SelectItem key={dir.id} value={dir.id}>
                    {dir.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Container Type *</Label>
            <Select
              value={config.containerType}
              onValueChange={(val) => onChange({ containerType: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {containerTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Container Size *</Label>
            <Select
              value={config.containerSize}
              onValueChange={(val) => onChange({ containerSize: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select size" />
              </SelectTrigger>
              <SelectContent>
                {containerSizes.map((size) => (
                  <SelectItem key={size.id} value={size.id}>
                    {size.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Quantity</Label>
            <Input
              type="number"
              value={config.quantity}
              onChange={(e) => onChange({ quantity: Number(e.target.value) })}
              min={1}
            />
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
