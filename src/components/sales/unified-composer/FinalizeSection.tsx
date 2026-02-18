import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Save, FileText, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { RateOption } from '@/types/quote-breakdown';

interface ChargeEntry {
  id?: string;
  category: string;
  name: string;
  amount: number;
  currency: string;
  unit?: string;
  note?: string;
}

interface FinalizeSectionProps {
  selectedOption: RateOption;
  onSaveQuote: (charges: ChargeEntry[], marginPercent: number, notes: string) => void;
  onGeneratePdf?: () => void;
  saving?: boolean;
}

export function FinalizeSection({ selectedOption, onSaveQuote, onGeneratePdf, saving = false }: FinalizeSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const [marginPercent, setMarginPercent] = useState(15);
  const [autoMargin, setAutoMargin] = useState(true);
  const [notes, setNotes] = useState('');

  // Build initial charges from the selected option
  const [charges, setCharges] = useState<ChargeEntry[]>(() => {
    const initial: ChargeEntry[] = [];
    const currency = selectedOption.currency || 'USD';

    // Gather charges from legs
    if (selectedOption.legs) {
      selectedOption.legs.forEach(leg => {
        if (leg.charges) {
          leg.charges.forEach(c => {
            initial.push({
              category: c.category || 'Freight',
              name: c.name || 'Charge',
              amount: c.amount || 0,
              currency: c.currency || currency,
              unit: c.unit,
              note: c.note,
            });
          });
        }
      });
    }

    // Add global charges
    if (selectedOption.charges) {
      selectedOption.charges.forEach(c => {
        initial.push({
          category: c.category || 'Fee',
          name: c.name || 'Charge',
          amount: c.amount || 0,
          currency: c.currency || currency,
          unit: c.unit,
          note: c.note,
        });
      });
    }

    // If no charges found, create one from total
    if (initial.length === 0 && selectedOption.price > 0) {
      initial.push({
        category: 'Freight',
        name: 'Base Freight',
        amount: selectedOption.price,
        currency,
      });
    }

    return initial;
  });

  const totalSell = useMemo(() => charges.reduce((sum, c) => sum + (c.amount || 0), 0), [charges]);
  const buyPrice = useMemo(() => {
    if (!autoMargin) return totalSell;
    return Number((totalSell * (1 - marginPercent / 100)).toFixed(2));
  }, [totalSell, marginPercent, autoMargin]);
  const marginAmount = totalSell - buyPrice;

  const handleAddCharge = () => {
    setCharges(prev => [
      ...prev,
      { category: 'Fee', name: '', amount: 0, currency: selectedOption.currency || 'USD' },
    ]);
  };

  const handleUpdateCharge = (idx: number, field: keyof ChargeEntry, value: any) => {
    setCharges(prev => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };

  const handleRemoveCharge = (idx: number) => {
    setCharges(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    onSaveQuote(charges, marginPercent, notes);
  };

  return (
    <Card className="border-primary/20" data-testid="finalize-section">
      <CardHeader className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Finalize Quote — {selectedOption.carrier || 'Selected Option'}
          </span>
          <div className="flex items-center gap-3">
            <Badge variant="secondary">{formatCurrency(totalSell, selectedOption.currency || 'USD')}</Badge>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </CardTitle>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-6">
          {/* Option Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Carrier</span>
              <p className="font-medium">{selectedOption.carrier || 'N/A'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Transit</span>
              <p className="font-medium">{selectedOption.transitTime || 'N/A'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Mode</span>
              <p className="font-medium capitalize">{selectedOption.transport_mode || 'N/A'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Tier</span>
              <p className="font-medium capitalize">{selectedOption.tier || 'standard'}</p>
            </div>
          </div>

          <Separator />

          {/* Charges Editor */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Charges</h4>
              <Button type="button" variant="outline" size="sm" onClick={handleAddCharge}>
                <Plus className="w-3 h-3 mr-1" /> Add Charge
              </Button>
            </div>

            <div className="space-y-2">
              {charges.map((charge, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-3">
                    <Input
                      value={charge.category}
                      onChange={(e) => handleUpdateCharge(idx, 'category', e.target.value)}
                      placeholder="Category"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="col-span-4">
                    <Input
                      value={charge.name}
                      onChange={(e) => handleUpdateCharge(idx, 'name', e.target.value)}
                      placeholder="Charge name"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      value={charge.amount}
                      onChange={(e) => handleUpdateCharge(idx, 'amount', Number(e.target.value))}
                      className="h-8 text-xs text-right"
                    />
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveCharge(idx)} className="h-7 w-7 p-0">
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Margin Controls */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Margin</Label>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Auto-Margin</Label>
                <Switch checked={autoMargin} onCheckedChange={setAutoMargin} />
              </div>
            </div>
            {autoMargin && (
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  value={marginPercent}
                  onChange={(e) => setMarginPercent(Number(e.target.value))}
                  className="w-24 h-8 text-sm"
                  min={0}
                  max={100}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            )}
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Sell Price</span>
                <p className="font-semibold">{formatCurrency(totalSell, selectedOption.currency || 'USD')}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Buy Price</span>
                <p className="font-semibold">{formatCurrency(buyPrice, selectedOption.currency || 'USD')}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Margin</span>
                <p className="font-semibold text-green-600">{formatCurrency(marginAmount, selectedOption.currency || 'USD')}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Customer Notes */}
          <div className="space-y-2">
            <Label className="text-sm">Customer Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes for the customer..."
              rows={3}
              className="text-sm"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} className="flex-1" disabled={saving} data-testid="save-quote-btn">
              {saving ? (
                <><Save className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                <><Save className="w-4 h-4 mr-2" /> Save Quote</>
              )}
            </Button>
            {onGeneratePdf && (
              <Button type="button" variant="outline" onClick={onGeneratePdf} disabled={saving}>
                <FileText className="w-4 h-4 mr-1" /> Generate PDF
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
