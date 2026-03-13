
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
import { v4 as uuidv4 } from 'uuid';

export interface SharedCargoInputProps {
  value: CargoItem;
  onChange: (value: CargoItem) => void;
  onCommodityChange?: (value: string) => void;
  onRemove?: () => void;
  className?: string;
  errors?: any;
  disableMultiContainer?: boolean;
}

export function SharedCargoInput({ value, onChange, onCommodityChange, onRemove, className, errors, disableMultiContainer }: SharedCargoInputProps) {
  const [showHazmat, setShowHazmat] = useState(!!value.hazmat);
  const [showWizard, setShowWizard] = useState(false);
  const weightErrorId = React.useId();
  const { containerTypes, containerSizes, formatSize, loading: containerRefsLoading, error: containerRefsError, retry: retryContainerRefs } = useContainerRefs();

  // Initialize container combos if in container mode but combos missing
  React.useEffect(() => {
    if (value.type === 'container' && (!value.containerCombos || value.containerCombos.length === 0)) {
        // Create initial combo from existing single fields (if present) or force explicit selection.
        const initialCombo = {
            id: uuidv4(),
            typeId: value.containerDetails?.typeId || '',
            sizeId: value.containerDetails?.sizeId || '',
            quantity: value.quantity || 1
        };

        onChange({
            ...value,
            containerCombos: [initialCombo]
        });
    }
  }, [value.type, value.containerCombos?.length, containerTypes, containerSizes]); // Dependencies carefully chosen

  const computeTotalVolume = (dims: CargoItem['dimensions'], quantity: number) => {
    if (!dims || dims.l <= 0 || dims.w <= 0 || dims.h <= 0) return value.volume;
    const factor = dims.unit === 'cm' ? 1000000 : 61023.7;
    const perUnitCbm = (dims.l * dims.w * dims.h) / factor;
    const totalCbm = perUnitCbm * Math.max(1, Number(quantity) || 1);
    return parseFloat(totalCbm.toFixed(3));
  };

  const handleCommoditySelect = (selection: CommoditySelection) => {
    console.log('[SharedCargoInput] Commodity selected:', selection);
    const nextDescription = selection.description || '';
    const currentDescription = value.commodity?.description || '';
    const updated = {
      ...value,
      commodity: {
        description: nextDescription,
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

    console.log('[SharedCargoInput] Calling onChange with updated cargo item:', updated);
    onChange(updated);
    if (nextDescription !== currentDescription) {
      onCommodityChange?.(nextDescription);
    }
  };

  const handleCommodityInputChange = (description: string) => {
    const currentDescription = value.commodity?.description || '';
    if (description === currentDescription) return;
    onChange({
      ...value,
      commodity: description
        ? {
            ...value.commodity,
            description,
            hts_code: value.commodity?.hts_code || '',
          }
        : undefined,
    });
    onCommodityChange?.(description || '');
  };

  const updateField = <K extends keyof CargoItem>(field: K, val: CargoItem[K]) => {
    if (field === 'quantity') {
      const quantity = Number(val) || 1;
      const nextVolume = computeTotalVolume(value.dimensions, quantity);
      onChange({ ...value, [field]: val, volume: nextVolume });
      return;
    }
    onChange({ ...value, [field]: val });
  };

  const updateCombo = (index: number, field: 'typeId' | 'sizeId' | 'quantity', val: any) => {
    const newCombos = [...(value.containerCombos || [])];
    const existingCombo = newCombos[index] || { typeId: '', sizeId: '', quantity: 1 };
    const nextCombo = { ...existingCombo, [field]: val };
    if (field === 'typeId') {
      nextCombo.sizeId = '';
    }
    newCombos[index] = nextCombo;
    
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
        id: uuidv4(),
        typeId: '',
        sizeId: '',
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
    
    const vol = computeTotalVolume(newDims, value.quantity);
    
    onChange({
      ...value,
      dimensions: newDims,
      volume: vol
    });
  };

  const updateDimensionUnit = (unit: 'cm' | 'in') => {
      const newDims = { ...value.dimensions, unit };
      const vol = computeTotalVolume(newDims, value.quantity);
       onChange({ ...value, dimensions: newDims, volume: vol });
  }

  const updateWeight = (val: string) => {
    const parsed = Number((val || '').replace(/,/g, '').trim());
    const num = Number.isFinite(parsed) ? parsed : 0;
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
            <Button type="button" variant="ghost" size="icon" onClick={onRemove} className="text-muted-foreground hover:text-destructive">
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
                            type="button"
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
                    {containerRefsError && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800 flex items-center justify-between">
                        <span>Unable to load container metadata.</span>
                        <Button type="button" variant="ghost" size="sm" onClick={() => retryContainerRefs?.()} className="h-6 px-2 text-xs">
                          Retry
                        </Button>
                      </div>
                    )}
                    {value.containerCombos?.map((combo, idx) => (
                        (() => {
                          const matchedType = containerTypes.find(
                            (t: any) =>
                              t.id === combo.typeId ||
                              String(t.name || '').toLowerCase() === String(combo.typeId || '').toLowerCase() ||
                              String(t.code || '').toLowerCase() === String(combo.typeId || '').toLowerCase()
                          );
                          const resolvedTypeId = matchedType?.id || combo.typeId;
                          const strictSizes = containerSizes.filter(
                            (s: any) =>
                              !resolvedTypeId ||
                              s.type_id === resolvedTypeId ||
                              s.container_type_id === resolvedTypeId
                          );
                          // Some datasets don't backfill type links for all size rows.
                          // If strict mapping yields none, show all active sizes from metadata.
                          const sizeOptions = strictSizes.length > 0 ? strictSizes : containerSizes;
                          const matchedSize = sizeOptions.find(
                            (s: any) =>
                              s.id === combo.sizeId ||
                              String(s.name || '').toLowerCase() === String(combo.sizeId || '').toLowerCase() ||
                              String(s.iso_code || '').toLowerCase() === String(combo.sizeId || '').toLowerCase()
                          );
                          const resolvedSizeId = matchedSize?.id || combo.sizeId;
                          return (
                        <div key={combo.id || idx} className="grid grid-cols-12 gap-2 items-end">
                            <div className="col-span-5 space-y-1">
                                <Label className={cn("text-[10px]", errors?.containerCombos?.[idx]?.typeId || errors?.containerType ? "text-destructive" : "text-muted-foreground")}>Type</Label>
                                <Select 
                                    value={resolvedTypeId} 
                                    onValueChange={(v) => updateCombo(idx, 'typeId', v)}
                                >
                                    <SelectTrigger 
                                        aria-label={`Container type ${idx + 1}`} 
                                        className={cn("h-8 text-xs bg-white", (errors?.containerCombos?.[idx]?.typeId || errors?.containerType) && "border-destructive focus:ring-destructive")}
                                    >
                                      <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent role="listbox" aria-label={`Container type options ${idx + 1}`}>
                                        {containerTypes.map(t => (
                                            <SelectItem key={t.id} value={t.id} aria-selected={resolvedTypeId === t.id}>{t.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {(errors?.containerCombos?.[idx]?.typeId || errors?.containerType) && (
                                  <p className="text-[10px] text-destructive mt-0.5 truncate">
                                    {errors?.containerCombos?.[idx]?.typeId?.message || errors?.containerType?.message || "Required"}
                                  </p>
                                )}
                            </div>
                            <div className="col-span-4 space-y-1">
                                <Label className={cn("text-[10px]", errors?.containerCombos?.[idx]?.sizeId || errors?.containerSize ? "text-destructive" : "text-muted-foreground")}>Size</Label>
                                <Select 
                                    value={resolvedSizeId} 
                                    onValueChange={(v) => updateCombo(idx, 'sizeId', v)}
                                    disabled={!resolvedTypeId}
                                >
                                    <SelectTrigger 
                                        aria-label={`Container size ${idx + 1}`} 
                                        className={cn("h-8 text-xs bg-white", (errors?.containerCombos?.[idx]?.sizeId || errors?.containerSize) && "border-destructive focus:ring-destructive")}
                                    >
                                      <SelectValue placeholder="Select size" />
                                    </SelectTrigger>
                                    <SelectContent role="listbox" aria-label={`Container size options ${idx + 1}`}>
                                        {sizeOptions.map((s: any) => (
                                                <SelectItem key={s.id} value={s.id} aria-selected={resolvedSizeId === s.id}>{formatSize(s.name)}</SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                                {(errors?.containerCombos?.[idx]?.sizeId || errors?.containerSize) && (
                                  <p className="text-[10px] text-destructive mt-0.5 truncate">
                                    {errors?.containerCombos?.[idx]?.sizeId?.message || errors?.containerSize?.message || "Required"}
                                  </p>
                                )}
                            </div>
                            <div className="col-span-2 space-y-1">
                                <Label className={cn("text-[10px]", errors?.containerCombos?.[idx]?.quantity || errors?.containerQty ? "text-destructive" : "text-muted-foreground")}>Qty</Label>
                                <Input 
                                    type="number"
                                    min={1}
                                    className={cn("h-8 text-xs bg-white px-2", (errors?.containerCombos?.[idx]?.quantity || errors?.containerQty) && "border-destructive focus-visible:ring-destructive")}
                                    value={combo.quantity}
                                    onChange={(e) => updateCombo(idx, 'quantity', parseInt(e.target.value) || 1)}
                                />
                                {(errors?.containerCombos?.[idx]?.quantity || errors?.containerQty) && (
                                  <p className="text-[10px] text-destructive mt-0.5 truncate">
                                    {errors?.containerCombos?.[idx]?.quantity?.message || errors?.containerQty?.message || "Invalid"}
                                  </p>
                                )}
                            </div>
                            <div className="col-span-1 pb-1">
                                {!disableMultiContainer && (
                                    <Button
                                        type="button"
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
                          );
                        })()
                    ))}
                    {containerRefsLoading && (
                      <div className="text-[11px] text-muted-foreground">Loading container metadata...</div>
                    )}
                </div>
             </div>
        )}

        {/* Main Grid - Optimized for Sidebar/Narrow widths */}
        <div className="space-y-4">
          {/* Commodity - Full Width to prevent overlap */}
          <div className="space-y-1">
            <Label className={cn("text-xs", errors?.commodity ? "text-destructive" : "text-muted-foreground")}>Commodity</Label>
            <SmartCargoInput
              onSelect={handleCommoditySelect}
              onInputChange={handleCommodityInputChange}
              placeholder="Search commodity or HTS code..."
              error={!!errors?.commodity}
              value={value.commodity?.description}
            />
            {errors?.commodity && <p className="text-[10px] text-destructive mt-0.5">{errors.commodity.message || "Required"}</p>}
          </div>

          {/* Secondary Fields Row */}
          <div className="grid grid-cols-3 gap-4">
            {/* Quantity */}
            <div className="space-y-1">
              <Label className={cn("text-xs", errors?.quantity ? "text-destructive" : "text-muted-foreground")}>Quantity {value.type === 'container' && '(Total)'}</Label>
              <Input
                type="number"
                min={1}
                value={value.quantity}
                disabled={value.type === 'container'}
                className={cn(value.type === 'container' ? "bg-muted text-muted-foreground" : "", errors?.quantity && "border-destructive focus-visible:ring-destructive")}
                onChange={(e) => updateField('quantity', parseInt(e.target.value) || 1)}
              />
              {errors?.quantity && <p className="text-[10px] text-destructive mt-0.5">{errors.quantity.message || "Invalid quantity"}</p>}
            </div>

            {/* Stackable */}
            <div className="flex flex-col justify-end pb-2">
               <div className="flex items-center space-x-2">
                  <Switch 
                      id={`stackable-${value.id}`} 
                      checked={value.stackable}
                      onCheckedChange={(c) => updateField('stackable', c)}
                      className={errors?.stackable ? "border-destructive" : ""}
                      aria-invalid={!!errors?.stackable}
                  />
                  <Label htmlFor={`stackable-${value.id}`} className={cn("cursor-pointer flex items-center gap-1 text-xs whitespace-nowrap", errors?.stackable ? "text-destructive" : "")}>
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
                      className={cn("data-[state=checked]:bg-amber-500", errors?.dangerousGoods ? "border-destructive" : "")}
                      aria-invalid={!!errors?.dangerousGoods}
                  />
                  <Label htmlFor={`hazmat-${value.id}`} className={cn("cursor-pointer flex items-center gap-1 font-medium text-xs whitespace-nowrap", errors?.dangerousGoods ? "text-destructive" : "text-amber-700")}>
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
                    <Ruler className={cn("w-4 h-4", (errors?.dimensions?.l || errors?.dimensions?.w || errors?.dimensions?.h) ? "text-destructive" : "text-muted-foreground")} />
                    <Label className={cn("text-xs font-semibold", (errors?.dimensions?.l || errors?.dimensions?.w || errors?.dimensions?.h) ? "text-destructive" : "")}>Dimensions (LxWxH)</Label>
                </div>
                <div className="flex items-center gap-2">
                    <Input 
                        placeholder="L" 
                        value={value.dimensions.l || ''} 
                        onChange={(e) => updateDimension('l', e.target.value)}
                        className={cn("h-8 text-sm px-2", errors?.dimensions?.l && "border-destructive focus-visible:ring-destructive")}
                        aria-invalid={!!errors?.dimensions?.l}
                    />
                    <span className="text-muted-foreground">x</span>
                    <Input 
                        placeholder="W" 
                        value={value.dimensions.w || ''} 
                        onChange={(e) => updateDimension('w', e.target.value)}
                        className={cn("h-8 text-sm px-2", errors?.dimensions?.w && "border-destructive focus-visible:ring-destructive")}
                        aria-invalid={!!errors?.dimensions?.w}
                    />
                    <span className="text-muted-foreground">x</span>
                    <Input 
                        placeholder="H" 
                        value={value.dimensions.h || ''} 
                        onChange={(e) => updateDimension('h', e.target.value)}
                        className={cn("h-8 text-sm px-2", errors?.dimensions?.h && "border-destructive focus-visible:ring-destructive")}
                        aria-invalid={!!errors?.dimensions?.h}
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
                {(errors?.dimensions?.l || errors?.dimensions?.w || errors?.dimensions?.h) && (
                    <p className="text-[10px] text-destructive mt-0.5">Dimensions required</p>
                )}
            </div>

             {/* Volume */}
             <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <Cuboid className={cn("w-4 h-4", errors?.volume ? "text-destructive" : "text-muted-foreground")} />
                    <Label className={cn("text-xs font-semibold", errors?.volume ? "text-destructive" : "")}>Volume (m³)</Label>
                </div>
                <Input 
                    type="number"
                    placeholder="Total Volume" 
                    value={value.volume || ''} 
                    onChange={(e) => updateField('volume', parseFloat(e.target.value))}
                    className={cn("h-8 text-sm", errors?.volume && "border-destructive focus-visible:ring-destructive")}
                    aria-invalid={!!errors?.volume}
                />
                {errors?.volume && <p className="text-[10px] text-destructive mt-0.5">{errors.volume.message || "Required"}</p>}
            </div>

            {/* Weight */}
            <div className="space-y-2" data-field-name="weight" aria-invalid={!!errors?.weight}>
                <div className="flex items-center gap-2">
                    <Scale className={cn("w-4 h-4", errors?.weight ? "text-destructive" : "text-muted-foreground")} />
                    <Label className={cn("text-xs font-semibold", errors?.weight ? "text-destructive" : "")}>Weight (Per Unit)</Label>
                </div>
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-md border border-transparent px-2 py-1 transition-all duration-200 ease-out",
                    errors?.weight && "border-destructive/60 bg-destructive/5 ring-1 ring-destructive/40"
                  )}
                >
                     <Input 
                        data-testid="cargo-weight"
                        id="weight-input"
                        name="weight"
                        placeholder="Weight" 
                        value={value.weight.value || ''} 
                        onChange={(e) => updateWeight(e.target.value)}
                        className={cn("h-8 text-sm transition-colors duration-200", errors?.weight && "border-destructive bg-destructive/5 focus-visible:ring-destructive")}
                        aria-invalid={!!errors?.weight}
                        aria-describedby={errors?.weight ? weightErrorId : undefined}
                        aria-errormessage={errors?.weight ? weightErrorId : undefined}
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
                {errors?.weight && (
                  <p id={weightErrorId} role="alert" aria-live="polite" className="text-[10px] text-destructive mt-0.5">
                    {errors.weight.message || "Required"}
                  </p>
                )}
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
                        <Label className={cn("text-[10px] uppercase", errors?.hazmat?.unNumber ? "text-destructive" : "text-amber-700")}>UN Number</Label>
                        <Input 
                            placeholder="e.g. 1263" 
                            className={cn("bg-white border-amber-200 h-8 text-sm", errors?.hazmat?.unNumber && "border-destructive focus-visible:ring-destructive")}
                            value={value.hazmat.unNumber}
                            onChange={(e) => onChange({...value, hazmat: {...value.hazmat!, unNumber: e.target.value}})}
                            aria-invalid={!!errors?.hazmat?.unNumber}
                        />
                        {errors?.hazmat?.unNumber && <p className="text-[10px] text-destructive mt-0.5">{errors.hazmat.unNumber.message || "Required"}</p>}
                    </div>
                    <div className="space-y-1">
                        <Label className={cn("text-[10px] uppercase", errors?.hazmat?.class ? "text-destructive" : "text-amber-700")}>Class</Label>
                        <Input 
                            placeholder="e.g. 3" 
                            className={cn("bg-white border-amber-200 h-8 text-sm", errors?.hazmat?.class && "border-destructive focus-visible:ring-destructive")}
                            value={value.hazmat.class}
                            onChange={(e) => onChange({...value, hazmat: {...value.hazmat!, class: e.target.value}})}
                            aria-invalid={!!errors?.hazmat?.class}
                        />
                        {errors?.hazmat?.class && <p className="text-[10px] text-destructive mt-0.5">{errors.hazmat.class.message || "Required"}</p>}
                    </div>
                    <div className="space-y-1">
                        <Label className={cn("text-[10px] uppercase", errors?.hazmat?.packingGroup ? "text-destructive" : "text-amber-700")}>Packing Group</Label>
                        <Select 
                            value={value.hazmat.packingGroup}
                            onValueChange={(v: any) => onChange({...value, hazmat: {...value.hazmat!, packingGroup: v}})}
                        >
                            <SelectTrigger 
                                className={cn("bg-white border-amber-200 h-8 text-sm", errors?.hazmat?.packingGroup && "border-destructive focus:ring-destructive")}
                                aria-invalid={!!errors?.hazmat?.packingGroup}
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="I">I (High Danger)</SelectItem>
                                <SelectItem value="II">II (Medium)</SelectItem>
                                <SelectItem value="III">III (Low)</SelectItem>
                            </SelectContent>
                        </Select>
                        {errors?.hazmat?.packingGroup && <p className="text-[10px] text-destructive mt-0.5">{errors.hazmat.packingGroup.message || "Required"}</p>}
                    </div>
                     <div className="space-y-1">
                        <Label className={cn("text-[10px] uppercase", errors?.hazmat?.flashPoint ? "text-destructive" : "text-amber-700")}>Flash Point</Label>
                        <div className="flex gap-1">
                             <Input 
                                type="number"
                                placeholder="Temp" 
                                className={cn("bg-white border-amber-200 h-8 text-sm", errors?.hazmat?.flashPoint && "border-destructive focus-visible:ring-destructive")}
                                value={value.hazmat.flashPoint?.value || ''}
                                onChange={(e) => onChange({
                                    ...value, 
                                    hazmat: {
                                        ...value.hazmat!, 
                                        flashPoint: { value: parseFloat(e.target.value) || 0, unit: value.hazmat?.flashPoint?.unit || 'C' }
                                    }
                                })}
                                aria-invalid={!!errors?.hazmat?.flashPoint}
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
                                <SelectTrigger className={cn("bg-white border-amber-200 h-8 text-sm w-14 px-1", errors?.hazmat?.flashPoint && "border-destructive focus:ring-destructive")}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="C">°C</SelectItem>
                                    <SelectItem value="F">°F</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {errors?.hazmat?.flashPoint && <p className="text-[10px] text-destructive mt-0.5">{errors.hazmat.flashPoint.message || "Required"}</p>}
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
