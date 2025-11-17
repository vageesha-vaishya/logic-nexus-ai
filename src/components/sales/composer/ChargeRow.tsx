import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Trash2, Settings } from 'lucide-react';

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
  return (
    <tr className="border-b hover:bg-accent/50 transition-colors">
      <td className="p-2">
        <Select
          value={charge.category_id || ''}
          onValueChange={(val) => onUpdate('category_id', val)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      
      <td className="p-2">
        <Select
          value={charge.basis_id || ''}
          onValueChange={(val) => onUpdate('basis_id', val)}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Basis" />
          </SelectTrigger>
          <SelectContent>
            {bases.map((basis) => (
              <SelectItem key={basis.id} value={basis.id}>
                {basis.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          <SelectContent>
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
            />
          </td>
          <td className="p-2">
            <div className="w-24 text-right font-medium">
              {((charge.buy?.quantity || 1) * (charge.buy?.rate || 0)).toFixed(2)}
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
            />
          </td>
          <td className="p-2">
            <div className="w-24 text-right font-medium">
              {((charge.sell?.quantity || 1) * (charge.sell?.rate || 0)).toFixed(2)}
            </div>
          </td>
          
          <td className="p-2">
            <div className={`w-24 text-right font-bold ${
              ((charge.sell?.quantity || 1) * (charge.sell?.rate || 0)) - 
              ((charge.buy?.quantity || 1) * (charge.buy?.rate || 0)) >= 0
                ? 'text-green-600' : 'text-red-600'
            }`}>
              {(
                ((charge.sell?.quantity || 1) * (charge.sell?.rate || 0)) - 
                ((charge.buy?.quantity || 1) * (charge.buy?.rate || 0))
              ).toFixed(2)}
            </div>
          </td>
        </>
      )}
      
      <td className="p-2">
        <Input
          value={charge.note || ''}
          onChange={(e) => onUpdate('note', e.target.value)}
          placeholder="Notes"
          className="w-32"
        />
      </td>
      
      <td className="p-2">
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={onConfigureBasis}
            title="Configure Basis"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onRemove}
            title="Remove Charge"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
