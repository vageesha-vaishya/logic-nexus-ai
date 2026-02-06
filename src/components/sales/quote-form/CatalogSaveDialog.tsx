import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { QuoteItem } from './types';

interface CatalogSaveDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    items: QuoteItem[];
    onSaved?: () => void;
}

export function CatalogSaveDialog({ open, onOpenChange, items, onSaved }: CatalogSaveDialogProps) {
    const { supabase } = useCRM();
    const [saving, setSaving] = useState<Record<number, boolean>>({});
    const [savedIds, setSavedIds] = useState<Set<number>>(new Set());

    const handleSave = async (item: QuoteItem, index: number) => {
        setSaving(prev => ({ ...prev, [index]: true }));
        try {
            const { error } = await supabase.from('master_commodities').insert({
                name: item.product_name,
                description: item.description,
                unit_value: item.unit_price,
                sku: `AUTO-${Date.now().toString().slice(-6)}-${index}`, // Simple auto-sku
                is_active: true
            });

            if (error) throw error;
            
            setSavedIds(prev => new Set(prev).add(index));
            toast.success(`Saved "${item.product_name}" to catalog`);
        } catch (error: any) {
            console.error('Error saving commodity:', error);
            toast.error(`Failed to save ${item.product_name}: ${error.message}`);
        } finally {
            setSaving(prev => ({ ...prev, [index]: false }));
        }
    };

    const remainingItems = items.filter((_, idx) => !savedIds.has(idx));

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Save New Commodities</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <p className="text-sm text-muted-foreground">
                        The following items are not in your master catalog. Save them to reuse in future quotes.
                    </p>
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                        {remainingItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-green-600 bg-green-50 rounded-lg">
                                <span className="text-lg font-medium">All items saved!</span>
                                <p className="text-sm opacity-80">You can close this dialog.</p>
                            </div>
                        ) : (
                            items.map((item, idx) => (
                                !savedIds.has(idx) && (
                                    <div key={idx} className="flex items-center justify-between p-3 border rounded-md bg-card">
                                        <div className="flex-1 min-w-0 mr-4">
                                            <p className="font-medium truncate">{item.product_name}</p>
                                            <p className="text-xs text-muted-foreground truncate">{item.description || 'No description'}</p>
                                        </div>
                                        <Button 
                                            size="sm" 
                                            variant="outline" 
                                            onClick={() => handleSave(item, idx)}
                                            disabled={saving[idx]}
                                        >
                                            {saving[idx] ? 'Saving...' : 'Save to Catalog'}
                                        </Button>
                                    </div>
                                )
                            ))
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)} variant={remainingItems.length === 0 ? "default" : "outline"}>
                        {remainingItems.length === 0 ? "Done" : "Close"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
