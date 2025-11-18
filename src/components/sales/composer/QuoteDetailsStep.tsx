import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface QuoteDetailsStepProps {
  quoteData: {
    reference?: string;
    validUntil?: string;
    notes?: string;
    currencyId?: string;
  };
  currencies: any[];
  onChange: (field: string, value: any) => void;
}

export function QuoteDetailsStep({ quoteData, currencies, onChange }: QuoteDetailsStepProps) {
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
