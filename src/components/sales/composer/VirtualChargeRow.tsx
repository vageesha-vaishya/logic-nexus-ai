
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Trash2, Settings } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface VirtualChargeRowProps {
  charge: any;
  categories: any[];
  bases: any[];
  currencies: any[];
  onUpdate: (field: string, value: any) => void;
  onRemove: () => void;
  onConfigureBasis: () => void;
  showBuySell?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export function VirtualChargeRow({
  charge,
  categories,
  bases,
  currencies,
  onUpdate,
  onRemove,
  onConfigureBasis,
  showBuySell = true,
  style,
  className
}: VirtualChargeRowProps) {
  const buyAmount = (charge.buy?.quantity || 1) * (charge.buy?.rate || 0);
  const sellAmount = (charge.sell?.quantity || 1) * (charge.sell?.rate || 0);
  const margin = sellAmount - buyAmount;
  const marginPercent = buyAmount > 0 ? ((margin / buyAmount) * 100) : 0;

  return (
    <div style={style} className={cn("border-b hover:bg-accent/50 transition-colors flex flex-col", className)}>
      {/* First Row - Main charge details with Buy fields */}
      <div className="flex items-center p-2 gap-2 h-[60px]">
        <div className="flex-1 min-w-[150px]">
          <Select
            value={charge.category_id || ''}
            onValueChange={(val) => onUpdate('category_id', val)}
          >
            <SelectTrigger className="w-full">
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
        </div>
        
        <div className="w-[140px] flex items-center gap-1">
          <Select
            value={charge.basis_id || ''}
            onValueChange={(val) => onUpdate('basis_id', val)}
          >
            <SelectTrigger className="w-full">
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
              className="h-9 w-9 p-0 flex-shrink-0"
              title="Configure container details"
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        <div className="w-[100px]">
          <Input
            value={charge.unit || ''}
            onChange={(e) => onUpdate('unit', e.target.value)}
            placeholder="Unit"
            className="w-full"
          />
        </div>
        
        <div className="w-[110px]">
          <Select
            value={charge.currency_id || ''}
            onValueChange={(val) => onUpdate('currency_id', val)}
          >
            <SelectTrigger className="w-full">
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
        </div>
        
        {showBuySell && (
          <>
            <div className="w-[100px]">
              <Input
                type="number"
                value={charge.buy?.quantity || 1}
                onChange={(e) => onUpdate('buy.quantity', Number(e.target.value))}
                className="w-full text-right"
              />
            </div>
            <div className="w-[120px]">
              <Input
                type="number"
                value={charge.buy?.rate || 0}
                onChange={(e) => onUpdate('buy.rate', Number(e.target.value))}
                className="w-full text-right"
                step="0.01"
              />
            </div>
            <div className="w-[120px] text-right font-medium px-2">
              {buyAmount.toFixed(2)}
            </div>
          </>
        )}
        
        <div className="w-[50px] flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Second Row - Sell fields and Note field */}
      {showBuySell && (
        <div className="flex items-start p-2 gap-2 bg-accent/20 h-[80px]">
          {/* Note in first column area */}
          <div className="flex-1 min-w-[150px] space-y-1">
            <span className="text-xs font-medium text-muted-foreground block">Note</span>
            <Textarea
              value={charge.note || ''}
              onChange={(e) => onUpdate('note', e.target.value)}
              placeholder="Add remarks or details..."
              className="resize-none text-sm h-[42px] w-full"
            />
          </div>

          {/* Spacers to align sell fields under Buy columns */}
          <div className="w-[140px]" /> {/* Basis */}
          <div className="w-[100px]" /> {/* Unit */}
          <div className="w-[110px]" /> {/* Currency */}

          {/* Sell Qty under Buy Qty */}
          <div className="w-[100px] space-y-1">
            <span className="text-xs font-medium text-muted-foreground block">Sell Qty</span>
            <Input
              type="number"
              value={charge.sell?.quantity || 1}
              onChange={(e) => onUpdate('sell.quantity', Number(e.target.value))}
              className="w-full text-right"
            />
          </div>

          {/* Sell Rate under Buy Rate */}
          <div className="w-[120px] space-y-1">
            <span className="text-xs font-medium text-muted-foreground block">Sell Rate</span>
            <Input
              type="number"
              value={charge.sell?.rate || 0}
              onChange={(e) => onUpdate('sell.rate', Number(e.target.value))}
              className="w-full text-right"
              step="0.01"
            />
          </div>

          {/* Sell Amt under Buy Amt */}
          <div className="w-[120px] space-y-1 text-right px-2">
            <span className="text-xs font-medium text-muted-foreground block">Sell Amt</span>
            <div className="font-medium">{sellAmount.toFixed(2)}</div>
          </div>

           {/* Margin under Actions */}
           <div className="w-[50px] space-y-1 text-center">
             <span className="text-xs font-medium text-muted-foreground block">Margin</span>
             <div className={cn("text-xs font-bold", margin >= 0 ? "text-green-600" : "text-destructive")}>
                {marginPercent.toFixed(0)}%
             </div>
           </div>
        </div>
      )}
    </div>
  );
}
