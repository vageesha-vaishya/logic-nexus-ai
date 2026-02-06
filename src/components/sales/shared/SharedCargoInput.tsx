
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Box, Container, Package, AlertTriangle, Layers, Scale, Ruler, Cuboid } from 'lucide-react';
import { SmartCargoInput, CommoditySelection } from '@/components/logistics/SmartCargoInput';
import { CargoItem } from '@/types/cargo';
import { cn } from '@/lib/utils';
import { useContainerRefs } from '@/hooks/useContainerRefs';
import { HazmatWizard } from './HazmatWizard';

interface SharedCargoInputProps {
  value: CargoItem;
  onChange: (value: CargoItem) => void;
  onRemove?: () => void;
  className?: string;
  errors?: Record<string, string>;
}

export function SharedCargoInput({ value, onChange, onRemove, className, errors }: SharedCargoInputProps) {
  const [showHazmat, setShowHazmat] = useState(!!value.hazmat);
  const [showWizard, setShowWizard] = useState(false);
  const { containerTypes, containerSizes, formatSize } = useContainerRefs();

  const handleCommoditySelect = (selection: CommoditySelection) => {
    const updated = {
      ...value,
      commodity: {
        description: selection.description,
        hts_code: selection.hts_code,
        id: selection.master_commodity_id,
      },
    };

    // Auto-populate Hazmat if available from master commodity
    if (selection.hazmat_class) {
      updated.hazmat = {
        class: selection.hazmat_class,
        unNumber: value.hazmat?.unNumber || '',
        packingGroup: value.hazmat?.packingGroup || 'II',
      };
      setShowHazmat(true);
    }

    onChange(updated);
  };

  const updateField = <K extends keyof CargoItem>(field: K, val: CargoItem[K]) => {
    onChange({ ...value, [field]: val });
  };

  const updateContainer = (key: 'typeId' | 'sizeId', val: string) => {
    onChange({
        ...value,
        containerDetails: {
            ...value.containerDetails,
            [key]: val
        }
    });
  };

  const updateDimension = (field: 'l' | 'w' | 'h', val: string) => {
    const num = parseFloat(val) || 0;
    const newDims = { ...value.dimensions, [field]: num };
    
    // Auto-calc volume if all dims are present
    let vol = value.volume;
    if (newDims.l > 0 && newDims.w > 0 && newDims.h > 0) {
        const factor = newDims.unit === 'cm' ? 1000000 : 61023.7;
        vol = parseFloat(((newDims.l * newDims.w * newDims.h) / factor).toFixed(3));
    }
    
    onChange({
      ...value,
      dimensions: newDims,
      volume: vol
    });
  };

  const updateDimensionUnit = (unit: 'cm' | 'in') => {
      const newDims = { ...value.dimensions, unit };
      let vol = value.volume;
       if (newDims.l > 0 && newDims.w > 0 && newDims.h > 0) {
        const factor = unit === 'cm' ? 1000000 : 61023.7;
        vol = parseFloat(((newDims.l * newDims.w * newDims.h) / factor).toFixed(3));
       }
       onChange({ ...value, dimensions: newDims, volume: vol });
  }

  const updateWeight = (val: string) => {
    const num = parseFloat(val) || 0;
    onChange({
      ...value,
      weight: { ...value.weight, value: num },
    });
  };

  const toggleHazmat = (enabled: boolean) => {
    setShowHazmat(enabled);
    if (enabled) {
      if (!value.hazmat) {
        onChange({
          ...value,
          hazmat: {
            unNumber: '',
            class: '',
            packingGroup: 'II',
          },
        });
      }
    } else {
      const { hazmat, ...rest } = value;
      onChange(rest as CargoItem);
    }
  };

  return (
    <Card className={cn("border-l-4 border-l-primary/50 relative group", className)}>
      <CardContent className="p-4 space-y-4">
        {/* Header: Type Selection & Remove */}
        <div className="flex items-center justify-between">
          <Tabs
            value={value.type}
            onValueChange={(v) => updateField('type', v as any)}
            className="w-full max-w-md"
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="loose" className="flex items-center gap-2">
                <Box className="w-4 h-4" /> Loose
              </TabsTrigger>
              <TabsTrigger value="container" className="flex items-center gap-2">
                <Container className="w-4 h-4" /> Container
              </TabsTrigger>
              <TabsTrigger value="unit" className="flex items-center gap-2">
                <Package className="w-4 h-4" /> Unit
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {onRemove && (
            <Button variant="ghost" size="icon" onClick={onRemove} className="text-muted-foreground hover:text-destructive">
              <span className="sr-only">Remove</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </Button>
          )}
        </div>
        
        {/* Container Details (Only if Type is Container) */}
        {value.type === 'container' && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50/50 p-3 rounded-md border border-blue-100">
                <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Container Type</Label>
                    <Select 
                        value={value.containerDetails?.typeId} 
                        onValueChange={(v) => updateContainer('typeId', v)}
                    >
                        <SelectTrigger className="h-9 bg-white"><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>
                            {containerTypes.map(t => (
                                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Container Size</Label>
                    <Select 
                        value={value.containerDetails?.sizeId} 
                        onValueChange={(v) => updateContainer('sizeId', v)}
                    >
                        <SelectTrigger className="h-9 bg-white"><SelectValue placeholder="Select size" /></SelectTrigger>
                        <SelectContent>
                             {containerSizes
                                .filter(s => !value.containerDetails?.typeId || s.type_id === value.containerDetails.typeId)
                                .map(s => (
                                    <SelectItem key={s.id} value={s.id}>{formatSize(s.name)}</SelectItem>
                                ))}
                        </SelectContent>
                    </Select>
                </div>
             </div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Commodity (Span 6) */}
          <div className="md:col-span-6 space-y-1">
            <Label className="text-xs text-muted-foreground">Commodity</Label>
            <SmartCargoInput
              onSelect={handleCommoditySelect}
              placeholder="Search commodity or HTS code..."
              className={errors?.commodity ? "border-red-500" : ""}
            />
            {value.commodity?.description && (
              <p className="text-xs text-muted-foreground truncate">
                Selected: {value.commodity.description} {value.commodity.hts_code && `(${value.commodity.hts_code})`}
              </p>
            )}
          </div>

          {/* Quantity (Span 2) */}
          <div className="md:col-span-2 space-y-1">
            <Label className="text-xs text-muted-foreground">Quantity</Label>
            <Input
              type="number"
              min={1}
              value={value.quantity}
              onChange={(e) => updateField('quantity', parseInt(e.target.value) || 1)}
            />
          </div>

          {/* Stackable (Span 2) */}
          <div className="md:col-span-2 flex flex-col justify-end pb-2">
             <div className="flex items-center space-x-2">
                <Switch 
                    id={`stackable-${value.id}`} 
                    checked={value.stackable}
                    onCheckedChange={(c) => updateField('stackable', c)}
                />
                <Label htmlFor={`stackable-${value.id}`} className="cursor-pointer flex items-center gap-1">
                    <Layers className="w-3 h-3" /> Stackable
                </Label>
            </div>
          </div>
          
           {/* Hazmat Toggle (Span 2) */}
           <div className="md:col-span-2 flex flex-col justify-end pb-2">
             <div className="flex items-center space-x-2">
                <Switch 
                    id={`hazmat-${value.id}`} 
                    checked={showHazmat}
                    onCheckedChange={toggleHazmat}
                    className="data-[state=checked]:bg-amber-500"
                />
                <Label htmlFor={`hazmat-${value.id}`} className="cursor-pointer flex items-center gap-1 text-amber-700 font-medium">
                    <AlertTriangle className="w-3 h-3" /> Hazmat
                </Label>
            </div>
          </div>
        </div>

        {/* Dimensions, Volume & Weight Row - Hidden if Container (assuming standard sizes, though payload weight matters) */}
        {/* Actually, even for containers, you need cargo weight. But dimensions might be implied by container size? 
            However, this is CARGO details inside the container or loose. 
            If it's 'container' type, it usually means FCL where the unit IS the container.
            So Dimensions are the container dimensions (standard) and Weight is the Payload Weight.
            I'll keep it visible but maybe optional for dimensions if container is selected.
        */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/20 p-3 rounded-md">
            {/* Dimensions */}
            <div className={cn("space-y-2", value.type === 'container' && "opacity-50 pointer-events-none")}>
                <div className="flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-xs font-semibold">Dimensions (LxWxH)</Label>
                </div>
                <div className="flex items-center gap-2">
                    <Input 
                        placeholder="L" 
                        value={value.dimensions.l || ''} 
                        onChange={(e) => updateDimension('l', e.target.value)}
                        className="h-8 text-sm px-2"
                    />
                    <span className="text-muted-foreground">x</span>
                    <Input 
                        placeholder="W" 
                        value={value.dimensions.w || ''} 
                        onChange={(e) => updateDimension('w', e.target.value)}
                        className="h-8 text-sm px-2"
                    />
                    <span className="text-muted-foreground">x</span>
                    <Input 
                        placeholder="H" 
                        value={value.dimensions.h || ''} 
                        onChange={(e) => updateDimension('h', e.target.value)}
                        className="h-8 text-sm px-2"
                    />
                    <Select 
                        value={value.dimensions.unit} 
                        onValueChange={updateDimensionUnit}
                    >
                        <SelectTrigger className="w-16 h-8 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="cm">cm</SelectItem>
                            <SelectItem value="in">in</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

             {/* Volume */}
             <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <Cuboid className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-xs font-semibold">Volume (m³)</Label>
                </div>
                <Input 
                    type="number"
                    placeholder="Total Volume" 
                    value={value.volume || ''} 
                    onChange={(e) => updateField('volume', parseFloat(e.target.value))}
                    className="h-8 text-sm"
                />
            </div>

            {/* Weight */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-xs font-semibold">Weight (Per Unit)</Label>
                </div>
                <div className="flex items-center gap-2">
                     <Input 
                        placeholder="Weight" 
                        value={value.weight.value || ''} 
                        onChange={(e) => updateWeight(e.target.value)}
                        className="h-8 text-sm"
                    />
                    <Select 
                        value={value.weight.unit} 
                        onValueChange={(v: 'kg' | 'lb') => onChange({...value, weight: {...value.weight, unit: v}})}
                    >
                        <SelectTrigger className="w-16 h-8 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="kg">kg</SelectItem>
                            <SelectItem value="lb">lb</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>

        {/* Hazmat Details (Collapsible) */}
        {showHazmat && value.hazmat && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2 mb-3 text-amber-800">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-semibold text-sm">Dangerous Goods Declaration</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-amber-700">UN Number</Label>
                        <Input 
                            placeholder="e.g. 1263" 
                            className="bg-white border-amber-200 h-8 text-sm"
                            value={value.hazmat.unNumber}
                            onChange={(e) => onChange({...value, hazmat: {...value.hazmat!, unNumber: e.target.value}})}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-amber-700">Class</Label>
                        <Input 
                            placeholder="e.g. 3" 
                            className="bg-white border-amber-200 h-8 text-sm"
                            value={value.hazmat.class}
                            onChange={(e) => onChange({...value, hazmat: {...value.hazmat!, class: e.target.value}})}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-amber-700">Packing Group</Label>
                        <Select 
                            value={value.hazmat.packingGroup}
                            onValueChange={(v: any) => onChange({...value, hazmat: {...value.hazmat!, packingGroup: v}})}
                        >
                            <SelectTrigger className="bg-white border-amber-200 h-8 text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="I">I (High Danger)</SelectItem>
                                <SelectItem value="II">II (Medium)</SelectItem>
                                <SelectItem value="III">III (Low)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-amber-700">Flash Point</Label>
                        <div className="flex gap-1">
                             <Input 
                                type="number"
                                placeholder="Temp" 
                                className="bg-white border-amber-200 h-8 text-sm"
                                value={value.hazmat.flashPoint?.value || ''}
                                onChange={(e) => onChange({
                                    ...value, 
                                    hazmat: {
                                        ...value.hazmat!, 
                                        flashPoint: { value: parseFloat(e.target.value) || 0, unit: value.hazmat?.flashPoint?.unit || 'C' }
                                    }
                                })}
                            />
                            <Select 
                                value={value.hazmat.flashPoint?.unit || 'C'}
                                onValueChange={(v: 'C' | 'F') => onChange({
                                    ...value, 
                                    hazmat: {
                                        ...value.hazmat!, 
                                        flashPoint: { value: value.hazmat?.flashPoint?.value || 0, unit: v }
                                    }
                                })}
                            >
                                <SelectTrigger className="bg-white border-amber-200 h-8 text-sm w-14 px-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="C">°C</SelectItem>
                                    <SelectItem value="F">°F</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            </div>
        )}

        <HazmatWizard 
            open={showWizard} 
            onOpenChange={setShowWizard}
            initialData={value.hazmat}
            onComplete={(details) => onChange({ ...value, hazmat: details })}
        />
      </CardContent>
    </Card>
  );
}
