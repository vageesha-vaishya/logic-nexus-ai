import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Trash2, Settings, Container } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

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

import { ContainerConfigurationDialog } from './ContainerConfigurationDialog';

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
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const buyAmount = (charge.buy?.quantity || 1) * (charge.buy?.rate || 0);
  const sellAmount = (charge.sell?.quantity || 1) * (charge.sell?.rate || 0);
  const margin = sellAmount - buyAmount;
  const marginPercent = buyAmount > 0 ? ((margin / buyAmount) * 100) : 0;

  const handleContainerSelect = (type: string) => {
    onUpdate('unit', type);
    setIsConfigOpen(false);
  };

  return (
    <>
      {/* First Row - Main charge details with Buy fields */}
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
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsConfigOpen(true)}
                  className="h-9 w-9 p-0"
                  title="Configure container details"
                >
                  <Settings className="h-4 w-4" />
                </Button>
                
                <ContainerConfigurationDialog
                  open={isConfigOpen}
                  onOpenChange={setIsConfigOpen}
                  selectedType={charge.unit}
                  onSelect={handleContainerSelect}
                />
              </>
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
      
      {/* Second Row - Sell fields and Note field */}
      {showBuySell && (
        <tr className="border-b bg-accent/20">
          {/* Note in first column */}
          <td className="p-2 align-top">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Note</span>
              <Textarea
                value={charge.note || ''}
                onChange={(e) => onUpdate('note', e.target.value)}
                placeholder="Add remarks or details..."
                className="resize-none text-sm h-[52px]"
              />
            </div>
          </td>

          {/* Empty cells to align sell fields under Buy columns */}
          <td className="p-2"></td>
          <td className="p-2"></td>
          <td className="p-2"></td>

          {/* Sell Qty under Buy Qty */}
          <td className="p-2">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Sell Qty</span>
              <Input
                type="number"
                value={charge.sell?.quantity || 1}
                onChange={(e) => onUpdate('sell.quantity', Number(e.target.value))}
                className="w-20 text-right"
              />
            </div>
          </td>

          {/* Sell Rate under Buy Rate */}
          <td className="p-2">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Sell Rate</span>
              <Input
                type="number"
                value={charge.sell?.rate || 0}
                onChange={(e) => onUpdate('sell.rate', Number(e.target.value))}
                className="w-24 text-right"
                step="0.01"
              />
            </div>
          </td>

          {/* Sell Amount under Buy Amount */}
          <td className="p-2">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Sell Amt</span>
              <div className="w-24 text-right font-medium">
                {sellAmount.toFixed(2)}
              </div>
            </div>
          </td>

          {/* Actions column placeholder */}
          <td className="p-2"></td>
        </tr>
      )}
    </>
  );
}
