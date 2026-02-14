
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Box, Container, Package, AlertTriangle, Layers, Scale, Ruler, Cuboid, Plus, Trash2 } from 'lucide-react';
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
  disableMultiContainer?: boolean;
}

export function SharedCargoInput({ value, onChange, onRemove, className, errors, disableMultiContainer }: SharedCargoInputProps) {
  const [showHazmat, setShowHazmat] = useState(!!value.hazmat);
  const [showWizard, setShowWizard] = useState(false);
  const { containerTypes, containerSizes, formatSize } = useContainerRefs();

  // Initialize container combos if in container mode but combos missing
  React.useEffect(() => {
    if (value.type === 'container' && (!value.containerCombos || value.containerCombos.length === 0)) {
        // Create initial combo from existing single fields or defaults
        const initialCombo = {
            id: crypto.randomUUID(),
            typeId: value.containerDetails?.typeId || containerTypes[0]?.id || '',
            sizeId: value.containerDetails?.sizeId || containerSizes.find(s => s.type_id === (value.containerDetails?.typeId || containerTypes[0]?.id))?.id || '',
            quantity: value.quantity || 1
        };
        
        // Only update if we have valid IDs to avoid infinite loops
        if (initialCombo.typeId && initialCombo.sizeId) {
            onChange({
                ...value,
                containerCombos: [initialCombo]
            });
        }
    }
  }, [value.type, value.containerCombos?.length, containerTypes, containerSizes]); // Dependencies carefully chosen

  const handleCommoditySelect = (selection: CommoditySelection) => {
    const updated = {
      ...value,
      commodity: {
        description: selection.description,
        hts_code: selection.hts_code,
        id: selection.master_commodity_id,
        aes_hts_id: selection.aes_hts_id,
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

  const updateCombo = (index: number, field: 'typeId' | 'sizeId' | 'quantity', val: any) => {
    const newCombos = [...(value.containerCombos || [])];
    newCombos[index] = { ...newCombos[index], [field]: val };
    
    // Recalculate total quantity
    const totalQty = newCombos.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0);
    
    onChange({
        ...value,
        containerCombos: newCombos,
        quantity: totalQty,
        // Sync legacy fields for backward compatibility with first combo
        containerDetails: index === 0 ? {
            ...value.containerDetails,
            typeId: field === 'typeId' ? val : newCombos[0].typeId,
            sizeId: field === 'sizeId' ? val : newCombos[0].sizeId
        } : value.containerDetails
    });
  };

  const addCombo = () => {
    const newCombo = {
        id: crypto.randomUUID(),
        typeId: containerTypes[0]?.id || '',
        sizeId: containerSizes.find(s => s.type_id === containerTypes[0]?.id)?.id || '',
        quantity: 1
    };
    
    const newCombos = [...(value.containerCombos || []), newCombo];
    const totalQty = newCombos.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0);

    onChange({
        ...value,
        containerCombos: newCombos,
        quantity: totalQty
    });
  };

  const removeCombo = (index: number) => {
    const newCombos = (value.containerCombos || []).filter((_, i) => i !== index);
    const totalQty = newCombos.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0);
    
    onChange({
        ...value,
        containerCombos: newCombos,
        quantity: totalQty
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
             <div className="space-y-3 bg-blue-50/50 p-3 rounded-md border border-blue-100">
                <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-blue-900">Container Configuration</Label>
                    {!disableMultiContainer && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={addCombo}
                            className="h-6 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-100 px-2"
                        >
                            <Plus className="w-3 h-3 mr-1" /> Add Container
                        </Button>
                    )}
                </div>
                
                <div className="space-y-2">
                    {value.containerCombos?.map((combo, idx) => (
                        <div key={combo.id || idx} className="grid grid-cols-12 gap-2 items-end">
                            <div className="col-span-5 space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Type</Label>
                                <Select 
                                    value={combo.typeId} 
                                    onValueChange={(v) => updateCombo(idx, 'typeId', v)}
                                >
                                    <SelectTrigger className="h-8 text-xs bg-white"><SelectValue placeholder="Type" /></SelectTrigger>
                                    <SelectContent>
                                        {containerTypes.map(t => (
                                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="col-span-4 space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Size</Label>
                                <Select 
                                    value={combo.sizeId} 
                                    onValueChange={(v) => updateCombo(idx, 'sizeId', v)}
                                >
                                    <SelectTrigger className="h-8 text-xs bg-white"><SelectValue placeholder="Size" /></SelectTrigger>
                                    <SelectContent>
                                        {containerSizes
                                            .filter(s => !combo.typeId || s.type_id === combo.typeId)
                                            .map(s => (
                                                <SelectItem key={s.id} value={s.id}>{formatSize(s.name)}</SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="col-span-2 space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Qty</Label>
                                <Input 
                                    type="number"
                                    min={1}
                                    className="h-8 text-xs bg-white px-2"
                                    value={combo.quantity}
                                    onChange={(e) => updateCombo(idx, 'quantity', parseInt(e.target.value) || 1)}
                                />
                            </div>
                            <div className="col-span-1 pb-1">
                                {!disableMultiContainer && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeCombo(idx)}
                                        disabled={value.containerCombos?.length === 1}
                                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
             </div>
        )}

        {/* Main Grid - Optimized for Sidebar/Narrow widths */}
        <div className="space-y-4">
          {/* Commodity - Full Width to prevent overlap */}
          <div className="space-y-1">
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

          {/* Secondary Fields Row */}
          <div className="grid grid-cols-3 gap-4">
            {/* Quantity */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Quantity {value.type === 'container' && '(Total)'}</Label>
              <Input
                type="number"
                min={1}
                value={value.quantity}
                disabled={value.type === 'container'}
                className={value.type === 'container' ? "bg-muted text-muted-foreground" : ""}
                onChange={(e) => updateField('quantity', parseInt(e.target.value) || 1)}
              />
            </div>

            {/* Stackable */}
            <div className="flex flex-col justify-end pb-2">
               <div className="flex items-center space-x-2">
                  <Switch 
                      id={`stackable-${value.id}`} 
                      checked={value.stackable}
                      onCheckedChange={(c) => updateField('stackable', c)}
                  />
                  <Label htmlFor={`stackable-${value.id}`} className="cursor-pointer flex items-center gap-1 text-xs whitespace-nowrap">
                      <Layers className="w-3 h-3" /> Stackable
                  </Label>
              </div>
            </div>
            
             {/* Hazmat Toggle */}
             <div className="flex flex-col justify-end pb-2">
               <div className="flex items-center space-x-2">
                  <Switch 
                      id={`hazmat-${value.id}`} 
                      checked={showHazmat}
                      onCheckedChange={toggleHazmat}
                      className="data-[state=checked]:bg-amber-500"
                  />
                  <Label htmlFor={`hazmat-${value.id}`} className="cursor-pointer flex items-center gap-1 text-amber-700 font-medium text-xs whitespace-nowrap">
                      <AlertTriangle className="w-3 h-3" /> Hazmat
                  </Label>
              </div>
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
