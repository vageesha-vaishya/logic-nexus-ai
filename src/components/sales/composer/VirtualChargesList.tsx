
import { useRef } from 'react';
import { VirtualChargeRow } from './VirtualChargeRow';
import { cn } from '@/lib/utils';

interface VirtualChargesListProps {
  charges: any[];
  categories: any[];
  bases: any[];
  currencies: any[];
  onUpdate: (idx: number, field: string, value: any) => void;
  onRemove: (idx: number) => void;
  onConfigureBasis: (idx: number) => void;
  height?: number | string;
}

export function VirtualChargesList({
  charges,
  categories,
  bases,
  currencies,
  onUpdate,
  onRemove,
  onConfigureBasis,
  height = 500
}: VirtualChargesListProps) {
  
  return (
    <div className="border rounded-lg shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-muted/50 border-b flex items-center px-2 gap-2 h-[40px] text-sm font-semibold text-muted-foreground">
        <div className="flex-1 min-w-[150px]">Category</div>
        <div className="w-[140px]">Basis</div>
        <div className="w-[100px]">Unit</div>
        <div className="w-[110px]">Currency</div>
        <div className="w-[100px] text-right">Buy Qty</div>
        <div className="w-[120px] text-right">Buy Rate</div>
        <div className="w-[120px] text-right px-2">Buy Amt</div>
        <div className="w-[50px] text-center">Actions</div>
      </div>

      {/* List (Non-virtualized fallback since react-window is missing) */}
      <div 
        style={{ height: typeof height === 'number' ? `${height}px` : height }} 
        className="bg-background overflow-y-auto"
      >
        {charges.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
            <p>No charges added yet</p>
          </div>
        ) : (
          charges.map((charge, index) => (
            <VirtualChargeRow
              key={charge.id || index}
              charge={charge}
              categories={categories}
              bases={bases}
              currencies={currencies}
              onUpdate={(field, value) => onUpdate(index, field, value)}
              onRemove={() => onRemove(index)}
              onConfigureBasis={() => onConfigureBasis(index)}
              className={index % 2 === 1 ? 'bg-muted/5' : ''}
            />
          ))
        )}
      </div>
    </div>
  );
}
