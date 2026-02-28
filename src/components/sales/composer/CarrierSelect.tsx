import * as React from 'react';
import { Check, ChevronsUpDown, Loader2, AlertCircle, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useCarriersByMode } from '@/hooks/useCarriersByMode';
import { normalizeModeCode } from '@/lib/mode-utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CreateCarrierDialog } from './CreateCarrierDialog';
import { EditCarrierDialog } from './EditCarrierDialog';
import { Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CarrierSelectProps {
  mode?: string | null;
  value?: string | null; // carrier_id
  onChange: (carrierId: string | null, carrierName?: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  showPreferred?: boolean;
  className?: string;
  error?: boolean;
}

export function CarrierSelect({
  mode,
  value,
  onChange,
  placeholder = 'Select carrier...',
  disabled,
  showPreferred = true,
  className,
  error,
}: CarrierSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const { getCarriersForMode, isLoading, error: fetchError, refetch } = useCarriersByMode();
  const { toast } = useToast();

  const carriers = React.useMemo(() => {
    if (!mode) return [];
    return getCarriersForMode(mode);
  }, [mode, getCarriersForMode]);

  const selectedCarrier = React.useMemo(
    () => carriers.find((c) => c.id === value),
    [carriers, value]
  );

  const handleCarrierCreated = (newCarrier: any) => {
    if (refetch) refetch();
    onChange(newCarrier.id, newCarrier.carrier_name);
  };

  const handleCarrierUpdated = () => {
    if (refetch) refetch();
  };

  const handleDeleteCarrier = async () => {
    if (!selectedCarrier) return;
    
    try {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('carriers')
        .update({ is_active: false })
        .eq('id', selectedCarrier.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Carrier deleted successfully."
      });
      
      onChange(null, null); // Clear selection
      if (refetch) refetch();
    } catch (error: any) {
      console.error('Error deleting carrier:', error);
      toast({
        title: "Error",
        description: "Failed to delete carrier.",
        variant: "destructive"
      });
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  // Group carriers by preferred status
  const { preferred, others } = React.useMemo(() => {
    const pref = [];
    const oth = [];
    for (const c of carriers) {
      if (c.is_preferred) pref.push(c);
      else oth.push(c);
    }
    return { preferred: pref, others: oth };
  }, [carriers]);

  const handleSelect = (carrierId: string) => {
    const carrier = carriers.find((c) => c.id === carrierId);
    onChange(carrierId, carrier?.carrier_name || null);
    setOpen(false);
  };

  return (
    <>
    <div className="flex gap-2 w-full items-center">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "flex-1 w-auto justify-between h-8 text-xs min-w-0",
              !value && "text-muted-foreground",
              error && "border-destructive text-destructive",
              className
            )}
            disabled={disabled || isLoading}
          >
            <span className="truncate">
              {selectedCarrier ? selectedCarrier.carrier_name : placeholder}
            </span>
            {isLoading ? (
              <Loader2 className="ml-2 h-3 w-3 animate-spin opacity-50" />
            ) : (
              <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search carrier..." className="h-8 text-xs" />
            <CommandList>
              <CommandEmpty>
                {fetchError ? (
                  <span className="text-destructive flex items-center gap-2">
                    <AlertCircle className="h-3 w-3" /> Failed to load carriers
                  </span>
                ) : isLoading ? (
                  <div className="flex items-center justify-center py-4 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading carriers...
                  </div>
                ) : (
                  "No carrier found."
                )}
                <div className="pt-2">
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start text-primary h-auto py-1.5 px-2 text-xs"
                    onClick={() => setCreateDialogOpen(true)}
                  >
                    <Plus className="mr-2 h-3 w-3" />
                    Create new carrier
                  </Button>
                </div>
              </CommandEmpty>
              
              {showPreferred && preferred.length > 0 && (
                <CommandGroup heading="Preferred Carriers">
                  {preferred.map((carrier) => (
                    <CommandItem
                      key={carrier.id}
                      value={carrier.carrier_name} // Use name for search filtering
                      onSelect={() => handleSelect(carrier.id)}
                      className="text-xs"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-3 w-3",
                          value === carrier.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {carrier.carrier_name}
                      <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1">Pref</Badge>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              <CommandGroup heading={showPreferred && preferred.length > 0 ? "All Carriers" : undefined}>
                {others.map((carrier) => (
                  <CommandItem
                    key={carrier.id}
                    value={carrier.carrier_name}
                    onSelect={() => handleSelect(carrier.id)}
                    className="text-xs"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-3 w-3",
                        value === carrier.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {carrier.carrier_name}
                    {carrier.scac && <span className="ml-2 text-[10px] text-muted-foreground">({carrier.scac})</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => setCreateDialogOpen(true)}
                  className="cursor-pointer text-primary text-xs"
                >
                  <Plus className="mr-2 h-3 w-3" />
                  Create new carrier
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedCarrier && (
        <div className="flex gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditDialogOpen(true)}>
                  <Pencil className="h-4 w-4 text-muted-foreground hover:text-primary" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit Carrier</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteDialogOpen(true)}>
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete Carrier</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>

    <CreateCarrierDialog 
      open={createDialogOpen} 
      onOpenChange={setCreateDialogOpen}
      onCarrierCreated={handleCarrierCreated}
      defaultMode={mode}
    />

    <EditCarrierDialog
      open={editDialogOpen}
      onOpenChange={setEditDialogOpen}
      carrier={selectedCarrier}
      onCarrierUpdated={handleCarrierUpdated}
    />

    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action will delete the carrier "{selectedCarrier?.carrier_name}". This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeleteCarrier} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
