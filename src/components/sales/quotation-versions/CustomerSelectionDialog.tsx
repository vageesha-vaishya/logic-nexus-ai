import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Loader2 } from 'lucide-react';

interface Option {
  id: string;
  option_name?: string | null;
  carrier_name: string;
  total_amount: number;
  currency: string;
  total_sell?: number;
}

interface CustomerSelectionDialogProps {
  open: boolean;
  onClose: () => void;
  versionId: string;
  options: Option[];
  onConfirm: (optionId: string, reason: string) => Promise<void>;
}

export function CustomerSelectionDialog({
  open,
  onClose,
  versionId,
  options,
  onConfirm,
}: CustomerSelectionDialogProps) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!selectedOptionId) return;

    setLoading(true);
    try {
      await onConfirm(selectedOptionId, reason);
      onClose();
      setSelectedOptionId(null);
      setReason('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Record Customer Selection</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Select an option that the customer chose:</Label>
            <div className="space-y-2">
              {options.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setSelectedOptionId(option.id)}
                  className={`w-full p-4 text-left border rounded-lg transition-all ${
                    selectedOptionId === option.id
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-medium">
                          {option.option_name || option.carrier_name}
                        </Badge>
                        {selectedOptionId === option.id && (
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Price: {option.currency} {Number(option.total_sell || option.total_amount).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Selection Reason (optional)</Label>
            <Textarea
              id="reason"
              placeholder="Why did the customer choose this option? E.g., Best price, fastest transit time, preferred carrier..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedOptionId || loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Record Selection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
