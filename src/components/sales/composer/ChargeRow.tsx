import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Trash2, Settings } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface ChargeRowProps {
  charge: any;
  categories: any[];
  bases: any[];
  currencies: any[];
  onUpdate: (field: string, value: any) => void;
  onRemove: () => void;
  onConfigureBasis: () => void;
  showBuySell?: boolean;
}

export function ChargeRow({
  charge,
  categories,
  bases,
  currencies,
  onUpdate,
  onRemove,
  onConfigureBasis,
  showBuySell = true
}: ChargeRowProps) {
  const buyAmount = (charge.buy?.quantity || 1) * (charge.buy?.rate || 0);
  const sellAmount = (charge.sell?.quantity || 1) * (charge.sell?.rate || 0);
  const margin = sellAmount - buyAmount;
  const marginPercent = buyAmount > 0 ? ((margin / buyAmount) * 100) : 0;

  return (
    <>
      {/* First Row - Main charge details */}
      <tr className="border-b hover:bg-accent/50 transition-colors">
        <td className="p-2">
          <Select
            value={charge.category_id || ''}
            onValueChange={(val) => onUpdate('category_id', val)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent className="z-50 bg-popover">
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </td>
        
        <td className="p-2">
          <div className="flex items-center gap-1">
            <Select
              value={charge.basis_id || ''}
              onValueChange={(val) => onUpdate('basis_id', val)}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Basis" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                {bases.map((basis) => (
                  <SelectItem key={basis.id} value={basis.id}>
                    {basis.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {charge.basis_id && bases.find(b => b.id === charge.basis_id)?.code === 'container' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onConfigureBasis}
                className="h-9 w-9 p-0"
                title="Configure container details"
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </div>
        </td>
        
        <td className="p-2">
          <Input
            value={charge.unit || ''}
            onChange={(e) => onUpdate('unit', e.target.value)}
            placeholder="Unit"
            className="w-24"
          />
        </td>
        
        <td className="p-2">
          <Select
            value={charge.currency_id || ''}
            onValueChange={(val) => onUpdate('currency_id', val)}
          >
            <SelectTrigger className="w-24">
              <SelectValue placeholder="Currency" />
            </SelectTrigger>
            <SelectContent className="z-50 bg-popover">
              {currencies.map((curr) => (
                <SelectItem key={curr.id} value={curr.id}>
                  {curr.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </td>
        
        {showBuySell && (
          <>
            <td className="p-2">
              <Input
                type="number"
                value={charge.buy?.quantity || 1}
                onChange={(e) => onUpdate('buy.quantity', Number(e.target.value))}
                className="w-20 text-right"
              />
            </td>
            <td className="p-2">
              <Input
                type="number"
                value={charge.buy?.rate || 0}
                onChange={(e) => onUpdate('buy.rate', Number(e.target.value))}
                className="w-24 text-right"
                step="0.01"
              />
            </td>
            <td className="p-2">
              <div className="w-24 text-right font-medium">
                {buyAmount.toFixed(2)}
              </div>
            </td>
            
            <td className="p-2">
              <Input
                type="number"
                value={charge.sell?.quantity || 1}
                onChange={(e) => onUpdate('sell.quantity', Number(e.target.value))}
                className="w-20 text-right"
              />
            </td>
            <td className="p-2">
              <Input
                type="number"
                value={charge.sell?.rate || 0}
                onChange={(e) => onUpdate('sell.rate', Number(e.target.value))}
                className="w-24 text-right"
                step="0.01"
              />
            </td>
            <td className="p-2">
              <div className="w-24 text-right font-medium">
                {sellAmount.toFixed(2)}
              </div>
            </td>
            
            <td className="p-2">
              <div className={`w-24 text-right font-semibold ${margin >= 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                {margin.toFixed(2)}
                <div className="text-xs opacity-70">({marginPercent.toFixed(1)}%)</div>
              </div>
            </td>
          </>
        )}
        
        <td className="p-2">
          <div className="flex items-center gap-1 justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </td>
      </tr>
      
      {/* Second Row - Note/Remark field */}
      <tr className="border-b bg-muted/20">
        <td colSpan={showBuySell ? 12 : 5} className="p-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Note:</span>
            <Textarea
              value={charge.note || ''}
              onChange={(e) => onUpdate('note', e.target.value)}
              placeholder="Add remarks or additional details about this charge..."
              className="min-h-[60px] resize-none text-sm"
            />
          </div>
        </td>
      </tr>
    </>
  );
}
