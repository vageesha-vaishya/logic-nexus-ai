import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Package, Plus, Trash2, Box } from 'lucide-react';
import { SharedCargoInput } from '@/components/sales/shared/SharedCargoInput';
import { CargoItem } from '@/types/cargo';

// Wrapper component for individual rows to optimize performance and handle local state mapping
function QuoteLineItemRow({ index, remove }: { index: number; remove: (index: number) => void }) {
    const { control, setValue } = useFormContext();
    
    // Watch specific fields for this item to construct the CargoItem object
    const itemValues = useWatch({
        control,
        name: `items.${index}`
    });

    // Construct CargoItem from form state
    // Note: We map the flat form structure to the nested CargoItem structure
    const cargoItem: CargoItem = {
        type: (itemValues?.type as 'loose' | 'container' | 'unit') || 'loose',
        quantity: itemValues?.quantity || 1,
        dimensions: {
            l: itemValues?.attributes?.length || 0,
            w: itemValues?.attributes?.width || 0,
            h: itemValues?.attributes?.height || 0,
            unit: 'cm' // Assuming CM for now, strictly numeric in current form
        },
        weight: {
            value: itemValues?.attributes?.weight || 0,
            unit: 'kg'
        },
        volume: itemValues?.attributes?.volume,
        commodity: {
            description: itemValues?.product_name || '',
            hts_code: itemValues?.attributes?.hs_code,
            id: itemValues?.commodity_id,
            aes_hts_id: itemValues?.aes_hts_id
        },
        hazmat: itemValues?.attributes?.hazmat,
        stackable: itemValues?.attributes?.stackable,
        containerDetails: {
            typeId: itemValues?.container_type_id,
            sizeId: itemValues?.container_size_id
        }
    };

    const handleCargoChange = (newCargo: CargoItem) => {
        // Update Type
        if (newCargo.type !== itemValues?.type) {
            setValue(`items.${index}.type`, newCargo.type);
        }

        // Update Container Details
        if (newCargo.type === 'container' && newCargo.containerDetails) {
            setValue(`items.${index}.container_type_id`, newCargo.containerDetails.typeId);
            setValue(`items.${index}.container_size_id`, newCargo.containerDetails.sizeId);
        } else {
            // Clear container details if not container type
            setValue(`items.${index}.container_type_id`, undefined);
            setValue(`items.${index}.container_size_id`, undefined);
        }

        // Update Stackable & Hazmat
        setValue(`items.${index}.attributes.stackable`, newCargo.stackable);
        setValue(`items.${index}.attributes.hazmat`, newCargo.hazmat);

        // Update Commodity/Description
        if (newCargo.commodity) {
            // If the description changed, update it
            if (newCargo.commodity.description !== itemValues?.product_name) {
                setValue(`items.${index}.product_name`, newCargo.commodity.description);
                // Also update the description field if it's empty or matches the old product name
                setValue(`items.${index}.description`, newCargo.commodity.description);
            }
            
            if (newCargo.commodity.id) {
                setValue(`items.${index}.commodity_id`, newCargo.commodity.id);
            }
            // Always update aes_hts_id (set or clear)
            setValue(`items.${index}.aes_hts_id`, newCargo.commodity.aes_hts_id);

            if (newCargo.commodity.hts_code) {
                setValue(`items.${index}.attributes.hs_code`, newCargo.commodity.hts_code);
            }
        }

        // Update Physical Attributes
        setValue(`items.${index}.attributes.length`, newCargo.dimensions.l);
        setValue(`items.${index}.attributes.width`, newCargo.dimensions.w);
        setValue(`items.${index}.attributes.height`, newCargo.dimensions.h);
        setValue(`items.${index}.attributes.weight`, newCargo.weight.value);
        
        // Update Volume (auto-calculated by SharedCargoInput)
        if (newCargo.volume !== undefined) {
            setValue(`items.${index}.attributes.volume`, newCargo.volume);
        }
    };

    return (
        <div className="relative p-4 border rounded-lg bg-card hover:bg-accent/5 transition-colors group">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Unified Cargo Input (Commodity + Dimensions + Weight) */}
                <div className="md:col-span-8 space-y-4">
                    <div className="space-y-2">
                        <FormLabel className="text-xs font-medium text-muted-foreground">Commodity & Cargo Details</FormLabel>
                        <SharedCargoInput 
                            value={cargoItem}
                            onChange={handleCargoChange}
                            disableMultiContainer={true}
                        />
                    </div>

                    {/* Additional Description Override */}
                    <FormField
                        control={control}
                        name={`items.${index}.description`}
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <Input {...field} placeholder="Additional details or specific instructions..." className="text-sm" />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                </div>

                {/* Financials / Commercial */}
                <div className="md:col-span-4 flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3">
                         <FormField
                            control={control}
                            name={`items.${index}.quantity`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">Quantity</FormLabel>
                                    <FormControl>
                                        <Input type="number" {...field} min={1} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={control}
                            name={`items.${index}.unit_price`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">Value (USD)</FormLabel>
                                    <FormControl>
                                        <Input type="number" {...field} min={0} step="0.01" />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </div>
                     <FormField
                        control={control}
                        name={`items.${index}.discount_percent`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs">Discount %</FormLabel>
                                <FormControl>
                                    <Input type="number" {...field} min={0} max={100} step="0.1" />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                </div>

                {/* Remove Button */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

export function QuoteLineItems() {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "items"
  });

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: fields.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 400, // Estimate height for complex row
    overscan: 3,
  });

  const handleAddItem = () => {
    append({
      line_number: fields.length + 1,
      product_name: '',
      description: '',
      quantity: 1,
      unit_price: 0,
      discount_percent: 0,
      attributes: {
        weight: 0,
        volume: 0,
        length: 0,
        width: 0,
        height: 0,
        hs_code: ''
      }
    });
  };

  return (
    <Card className="shadow-sm border-t-4 border-t-blue-600">
      <CardHeader>
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 rounded-lg">
                    <Package className="h-5 w-5 text-blue-700" />
                </div>
                <div>
                    <CardTitle className="text-xl text-blue-950">Cargo Details</CardTitle>
                    <CardDescription>Add items, packages, weights, and dimensions.</CardDescription>
                </div>
            </div>
            <Button onClick={handleAddItem} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Item
            </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {fields.length === 0 ? (
             <div className="text-center py-8 border-2 border-dashed rounded-lg bg-muted/50">
                <Box className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground font-medium">No items added yet</p>
                <p className="text-sm text-muted-foreground/80 mb-4">Add cargo details to calculate accurate shipping costs</p>
                <Button onClick={handleAddItem} variant="outline" size="sm">
                    Add First Item
                </Button>
             </div>
        ) : (
            <div 
                ref={parentRef}
                className="max-h-[800px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
            >
                <div
                    style={{
                        height: `${rowVirtualizer.getTotalSize()}px`,
                        width: '100%',
                        position: 'relative',
                    }}
                >
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => (
                        <div
                            key={virtualRow.key}
                            data-index={virtualRow.index}
                            ref={rowVirtualizer.measureElement}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                transform: `translateY(${virtualRow.start}px)`,
                                paddingBottom: '1rem', // Add spacing between rows
                            }}
                        >
                            <QuoteLineItemRow 
                                index={virtualRow.index} 
                                remove={remove} 
                            />
                        </div>
                    ))}
                </div>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
