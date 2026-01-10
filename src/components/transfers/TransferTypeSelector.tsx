import { Card, CardContent } from '@/components/ui/card';
import { TransferType } from '@/lib/transfer-service';
import { Building2, Users, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TransferTypeSelectorProps {
  value: TransferType;
  onChange: (type: TransferType) => void;
  disabled?: boolean;
}

const transferTypes = [
  {
    value: 'tenant_to_tenant' as TransferType,
    label: 'Tenant to Tenant',
    description: 'Transfer ownership between different organizations',
    icon: Building2,
  },
  {
    value: 'tenant_to_franchise' as TransferType,
    label: 'Tenant to Franchise',
    description: 'Assign records from corporate to a franchise location',
    icon: Users,
  },
  {
    value: 'franchise_to_franchise' as TransferType,
    label: 'Franchise to Franchise',
    description: 'Move records between franchise locations within same tenant',
    icon: ArrowRightLeft,
  },
];

export function TransferTypeSelector({ value, onChange, disabled }: TransferTypeSelectorProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {transferTypes.map((type) => (
        <Card
          key={type.value}
          className={cn(
            'cursor-pointer transition-all hover:border-primary',
            value === type.value && 'border-primary bg-primary/5 ring-1 ring-primary',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          onClick={() => !disabled && onChange(type.value)}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className={cn(
                'rounded-lg p-2',
                value === type.value ? 'bg-primary text-primary-foreground' : 'bg-muted'
              )}>
                <type.icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium">{type.label}</h4>
                <p className="text-xs text-muted-foreground mt-1">{type.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
