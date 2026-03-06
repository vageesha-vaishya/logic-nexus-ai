
import { memo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Trash2, Settings, Info } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { formatContainerSize } from '@/lib/container-utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface VirtualChargeRowProps {
  index: number;
  charge: any;
  categories: any[];
  bases: any[];
  currencies: any[];
  onUpdate: (index: number, field: string, value: any) => void;
  onRemove: (index: number) => void;
  onConfigureBasis: (index: number) => void;
  showBuySell?: boolean;
  style?: React.CSSProperties;
  className?: string;
  legMode?: string;
}

export const VirtualChargeRow = memo(function VirtualChargeRow({
  index,
  charge,
  categories,
  bases,
  currencies,
  onUpdate,
  onRemove,
  onConfigureBasis,
  showBuySell = true,
  style,
  className,
  legMode
}: VirtualChargeRowProps) {
  const buyAmount = (charge.buy?.quantity || 1) * (charge.buy?.rate || 0);
  const sellAmount = (charge.sell?.quantity || 1) * (charge.sell?.rate || 0);
  const margin = sellAmount - buyAmount;
  const marginPercent = buyAmount > 0 ? ((margin / buyAmount) * 100) : 0;

  const handleUpdate = useCallback((field: string, value: any) => {
    onUpdate(index, field, value);
  }, [index, onUpdate]);

  const handleRemove = useCallback(() => {
    onRemove(index);
  }, [index, onRemove]);

  const handleConfigureBasis = useCallback(() => {
    onConfigureBasis(index);
  }, [index, onConfigureBasis]);

  return (
    <div style={style} className={cn("border-b hover:bg-accent/50 transition-colors flex flex-col", className)}>
      {/* First Row - Main charge details with Buy fields */}
      <div className="flex items-center p-2 gap-2 h-[60px]">
        <div className="flex-1 min-w-[150px]">
          <Select
            value={charge.category_id || ''}
            onValueChange={(val) => handleUpdate('category_id', val)}
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
            onValueChange={(val) => handleUpdate('basis_id', val)}
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
              onClick={handleConfigureBasis}
              className="h-9 w-9 p-0 flex-shrink-0"
              title="Configure container details"
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
          {charge.basisDetails && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-9 w-9 p-0 flex-shrink-0" title="Basis details">
                    <Info className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <div className="text-xs space-y-1">
                    <div className="font-medium">Basis details</div>
                    <div className="text-muted-foreground font-mono whitespace-pre-wrap">
                      {JSON.stringify(charge.basisDetails, null, 2)}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {(() => {
            const basis = bases.find(b => b.id === charge.basis_id);
            const code = basis?.code;
            const details = charge.basisDetails;
            if (code === 'container' && details) {
              const unit = String(charge.unit || '');
              const sizePart = unit.includes('x') ? unit.split('x').slice(1).join('x') : unit;
              const sizeName = formatContainerSize(sizePart);
              const qty = Number(details.quantity || charge.buy?.quantity || 1);
              return (
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 min-w-[1.5rem] border-blue-500 text-blue-600 bg-blue-50">
                  {sizeName || 'FCL'} × {qty}
                </Badge>
              );
            }
            if (code === 'weight' && legMode === 'air') {
              return (
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 min-w-[1.5rem] border-cyan-500 text-cyan-600 bg-cyan-50">
                  per kg
                </Badge>
              );
            }
            if (code === 'volume' && legMode === 'ocean') {
              return (
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 min-w-[1.5rem] border-emerald-500 text-emerald-600 bg-emerald-50">
                  per cbm
                </Badge>
              );
            }
            return null;
          })()}
        </div>
        
        <div className="w-[100px]">
          <Input
            value={charge.unit || ''}
            onChange={(e) => handleUpdate('unit', e.target.value)}
            placeholder="Unit"
            className="w-full"
          />
        </div>
        
        <div className="w-[110px]">
          <Select
            value={charge.currency_id || ''}
            onValueChange={(val) => handleUpdate('currency_id', val)}
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
                onChange={(e) => handleUpdate('buy.quantity', Number(e.target.value))}
                className="w-full text-right"
              />
            </div>
            <div className="w-[120px]">
              <Input
                type="number"
                value={charge.buy?.rate || 0}
                onChange={(e) => handleUpdate('buy.rate', Number(e.target.value))}
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
            onClick={handleRemove}
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
              onChange={(e) => handleUpdate('note', e.target.value)}
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
              onChange={(e) => handleUpdate('sell.quantity', Number(e.target.value))}
              className="w-full text-right"
            />
          </div>

          {/* Sell Rate under Buy Rate */}
          <div className="w-[120px] space-y-1">
            <span className="text-xs font-medium text-muted-foreground block">Sell Rate</span>
            <Input
              type="number"
              value={charge.sell?.rate || 0}
              onChange={(e) => handleUpdate('sell.rate', Number(e.target.value))}
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
});
