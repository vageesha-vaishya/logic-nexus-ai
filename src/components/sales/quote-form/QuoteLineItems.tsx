
import { useFieldArray, useFormContext } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Package, Plus, Trash2, Box } from 'lucide-react';
// import { Separator } from '@/components/ui/separator';

export function QuoteLineItems() {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "items"
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
            <div className="space-y-4">
                {fields.map((field, index) => (
                    <div key={field.id} className="relative p-4 border rounded-lg bg-card hover:bg-accent/5 transition-colors group">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                            {/* Main Info */}
                            <div className="md:col-span-4 space-y-4">
                                <FormField
                                    control={control}
                                    name={`items.${index}.product_name`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Product / Commodity</FormLabel>
                                            <FormControl>
                                                <Input {...field} placeholder="e.g. Electronics, Furniture" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={control}
                                    name={`items.${index}.description`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Description</FormLabel>
                                            <FormControl>
                                                <Input {...field} placeholder="Additional details..." />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={control}
                                    name={`items.${index}.attributes.hs_code`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">HS Code</FormLabel>
                                            <FormControl>
                                                <Input {...field} placeholder="e.g. 8517.12" />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* Qty & Price */}
                            <div className="md:col-span-3 grid grid-cols-3 gap-2">
                                <FormField
                                    control={control}
                                    name={`items.${index}.quantity`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Qty</FormLabel>
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
                                <FormField
                                    control={control}
                                    name={`items.${index}.discount_percent`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">Disc %</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} min={0} max={100} step="0.1" />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* Dimensions */}
                            <div className="md:col-span-4 grid grid-cols-2 gap-2 p-3 bg-muted/30 rounded-md">
                                <FormField
                                    control={control}
                                    name={`items.${index}.attributes.weight`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs text-muted-foreground">Total Weight (kg)</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} min={0} step="0.1" className="h-8 bg-background" />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={control}
                                    name={`items.${index}.attributes.volume`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs text-muted-foreground">Total Volume (cbm)</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} min={0} step="0.01" className="h-8 bg-background" />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* Actions */}
                            <div className="md:col-span-1 flex items-center justify-end">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => remove(index)}
                                    className="text-muted-foreground hover:text-destructive transition-colors"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </CardContent>
    </Card>
  );
}
