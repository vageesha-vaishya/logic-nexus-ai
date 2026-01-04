import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { calculateChargeableWeight, formatWeight } from '@/utils/freightCalculations';
import { Plane, Ship, Truck } from 'lucide-react';

interface QuoteDetailsStepProps {
  quoteData: {
    reference?: string;
    validUntil?: string;
    notes?: string;
    currencyId?: string;
    incoterms?: string;
    total_weight?: string;
    total_volume?: string;
    commodity?: string;
  };
  currencies: any[];
  onChange: (field: string, value: any) => void;
}

const INCOTERMS = [
  'EXW - Ex Works',
  'FCA - Free Carrier',
  'CPT - Carriage Paid To',
  'CIP - Carriage and Insurance Paid To',
  'DAP - Delivered at Place',
  'DPU - Delivered at Place Unloaded',
  'DDP - Delivered Duty Paid',
  'FAS - Free Alongside Ship',
  'FOB - Free on Board',
  'CFR - Cost and Freight',
  'CIF - Cost, Insurance and Freight',
];

export function QuoteDetailsStep({ quoteData, currencies, onChange }: QuoteDetailsStepProps) {
  const weight = Number(quoteData.total_weight) || 0;
  const volume = Number(quoteData.total_volume) || 0;

  const airChgWeight = calculateChargeableWeight(weight, volume, 'air');
  const seaChgWeight = calculateChargeableWeight(weight, volume, 'sea');
  const roadChgWeight = calculateChargeableWeight(weight, volume, 'road');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quote Details</CardTitle>
        <CardDescription>Set up basic information for this quotation</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="reference">Reference Number</Label>
            <Input
              id="reference"
              value={quoteData.reference || ''}
              onChange={(e) => onChange('reference', e.target.value)}
              placeholder="Auto-generated if left empty"
            />
          </div>
          
          <div>
            <Label htmlFor="validUntil">Valid Until</Label>
            <Input
              id="validUntil"
              type="date"
              value={quoteData.validUntil || ''}
              onChange={(e) => onChange('validUntil', e.target.value)}
            />
            {daysRemaining !== null && (
              <p className={`text-xs mt-1 ${daysRemaining < 7 ? 'text-amber-500 font-medium' : 'text-muted-foreground'}`}>
                {daysRemaining < 0 ? 'Expired' : `${daysRemaining} days remaining`}
              </p>
            )}
          </div>
        </div>

        <div className="pt-4 border-t">
          <h4 className="font-medium mb-4">Logistics Parameters</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="incoterms">Incoterms (2020)</Label>
              <Select value={quoteData.incoterms} onValueChange={(val) => onChange('incoterms', val)}>
                <SelectTrigger id="incoterms">
                  <SelectValue placeholder="Select Incoterms" />
                </SelectTrigger>
                <SelectContent>
                  {INCOTERMS.map((term) => (
                    <SelectItem key={term} value={term.split(' - ')[0]}>
                      {term}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="commodity">Commodity / Cargo Type</Label>
              <Input
                id="commodity"
                value={quoteData.commodity || ''}
                onChange={(e) => onChange('commodity', e.target.value)}
                placeholder="e.g. Electronics, Textiles"
              />
            </div>
            <div>
              <Label htmlFor="total_weight">Total Weight (kg)</Label>
              <Input
                id="total_weight"
                type="number"
                value={quoteData.total_weight || ''}
                onChange={(e) => onChange('total_weight', e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="total_volume">Total Volume (cbm)</Label>
              <Input
                id="total_volume"
                type="number"
                value={quoteData.total_volume || ''}
                onChange={(e) => onChange('total_volume', e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        <div>
          <Label htmlFor="currency">Quote Currency</Label>
          <Select value={quoteData.currencyId} onValueChange={(val) => onChange('currencyId', val)}>
            <SelectTrigger id="currency">
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              {currencies.map((currency) => (
                <SelectItem key={currency.id} value={currency.id}>
                  {currency.code} - {currency.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={quoteData.notes || ''}
            onChange={(e) => onChange('notes', e.target.value)}
            placeholder="Add any special notes or terms for this quotation"
            rows={4}
          />
        </div>
      </CardContent>
    </Card>
  );
}
