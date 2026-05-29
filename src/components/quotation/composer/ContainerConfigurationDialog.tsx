import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Container, Info } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface ContainerType {
  code: string;
  name: string;
  category: 'Standard' | 'Reefer' | 'Specialized';
  description: string;
  capacity_cbm: number;
  max_weight_kg: number;
}

const CONTAINER_MATRIX: ContainerType[] = [
  // Standard
  { code: '20GP', name: "20' General Purpose", category: 'Standard', description: 'Standard dry cargo container', capacity_cbm: 33.2, max_weight_kg: 28200 },
  { code: '40GP', name: "40' General Purpose", category: 'Standard', description: 'Standard dry cargo container', capacity_cbm: 67.7, max_weight_kg: 26600 },
  { code: '40HC', name: "40' High Cube", category: 'Standard', description: 'High volume dry cargo', capacity_cbm: 76.4, max_weight_kg: 26500 },
  { code: '45HC', name: "45' High Cube", category: 'Standard', description: 'Extra volume dry cargo', capacity_cbm: 86.0, max_weight_kg: 25600 },
  // Reefer
  { code: '20RF', name: "20' Reefer", category: 'Reefer', description: 'Refrigerated container', capacity_cbm: 28.3, max_weight_kg: 27000 },
  { code: '40RF', name: "40' Reefer", category: 'Reefer', description: 'Refrigerated container', capacity_cbm: 57.8, max_weight_kg: 29000 },
  { code: '40HR', name: "40' High Cube Reefer", category: 'Reefer', description: 'High volume refrigerated', capacity_cbm: 67.0, max_weight_kg: 29000 },
  // Specialized
  { code: '20OT', name: "20' Open Top", category: 'Specialized', description: 'Open top for over-height cargo', capacity_cbm: 32.0, max_weight_kg: 28200 },
  { code: '40OT', name: "40' Open Top", category: 'Specialized', description: 'Open top for over-height cargo', capacity_cbm: 65.0, max_weight_kg: 26600 },
  { code: '20FR', name: "20' Flat Rack", category: 'Specialized', description: 'Flat rack for heavy/oversized', capacity_cbm: 0, max_weight_kg: 45000 },
  { code: '40FR', name: "40' Flat Rack", category: 'Specialized', description: 'Flat rack for heavy/oversized', capacity_cbm: 0, max_weight_kg: 45000 },
];

interface ContainerConfigurationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedType: string | undefined;
  onSelect: (type: string) => void;
}

export function ContainerConfigurationDialog({
  open,
  onOpenChange,
  selectedType,
  onSelect,
}: ContainerConfigurationDialogProps) {
  const groupedContainers = CONTAINER_MATRIX.reduce((acc, container) => {
    if (!acc[container.category]) acc[container.category] = [];
    acc[container.category].push(container);
    return acc;
  }, {} as Record<string, ContainerType[]>);

  const handleSelect = (code: string) => {
    onSelect(code);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Container className="w-5 h-5 text-primary" />
            Container Configuration
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Select the appropriate container type for this charge.
          </p>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="space-y-6">
            {Object.entries(groupedContainers).map(([category, containers]) => (
              <div key={category} className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2 text-primary">
                  {category} Containers
                  <Separator className="flex-1" />
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {containers.map((container) => (
                    <Button
                      key={container.code}
                      variant={selectedType === container.code ? 'default' : 'outline'}
                      className={`h-auto flex flex-col items-start p-4 gap-2 transition-all hover:border-primary ${
                        selectedType === container.code ? 'border-primary bg-primary/5 ring-1 ring-primary' : ''
                      }`}
                      onClick={() => handleSelect(container.code)}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold text-sm">{container.code}</span>
                        {selectedType === container.code && (
                           <Badge variant="default" className="text-[10px] h-5">Selected</Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground font-normal line-clamp-1">
                        {container.name}
                      </span>
                      <div className="flex items-center gap-2 mt-1 w-full text-[10px] text-muted-foreground font-normal">
                         <span className="bg-muted px-1.5 py-0.5 rounded">Max: {(container.max_weight_kg / 1000).toFixed(1)}T</span>
                         {container.capacity_cbm > 0 && (
                            <span className="bg-muted px-1.5 py-0.5 rounded">Vol: {container.capacity_cbm}m³</span>
                         )}
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
