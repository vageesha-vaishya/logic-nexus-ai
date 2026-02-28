import React, { useState, useEffect } from 'react';
import { AsyncCombobox, ComboOption } from '@/components/ui/async-combobox';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { CreateLocationDialog } from './CreateLocationDialog';
import { EditLocationDialog } from './EditLocationDialog';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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

interface LocationSelectProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function LocationSelect({
  value,
  onChange,
  placeholder = "Select city/port...",
  className,
  disabled,
}: LocationSelectProps) {
  const [displayValue, setDisplayValue] = useState<string>("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    setDisplayValue(value || "");
    if (value && !selectedLocation) {
      // Fetch location details if value exists but object doesn't (e.g. initial load)
      fetchLocationDetails(value);
    }
  }, [value]);

  const fetchLocationDetails = async (name: string) => {
    try {
      const { data, error } = await supabase
        .from('ports_locations')
        .select('*')
        .eq('location_name', name)
        .maybeSingle();
      
      if (data) {
        setSelectedLocation(data);
      }
    } catch (e) {
      console.error('Error fetching location details:', e);
    }
  };

  const loadLocations = React.useCallback(async (search: string): Promise<ComboOption[]> => {
    // If no search, load a default list of popular/top locations
    const isDefaultLoad = !search;
    
    try {
      // First try to fetch from the table directly to ensure basic connectivity
      let query = supabase
        .from('ports_locations')
        .select('location_name, location_code, city, country, location_type, id');
      
      if (search) {
        query = query.or(`location_name.ilike.%${search}%,city.ilike.%${search}%,location_code.ilike.%${search}%,country.ilike.%${search}%`);
      }
        
      const { data, error } = await query
        .eq('is_active', true)
        .order('location_name')
        .limit(isDefaultLoad ? 20 : 50);

      if (error) {
        console.error('LocationSelect Error fetching locations:', error);
        return [];
      }

      console.log('LocationSelect found results:', data?.length);

      // Deduplicate by location_name to prevent key collisions in Combobox
      const uniqueNames = new Set();
      const uniqueResults = [];
      
      for (const loc of (data || [])) {
        if (!uniqueNames.has(loc.location_name)) {
          uniqueNames.add(loc.location_name);
          uniqueResults.push(loc);
        }
      }

      return uniqueResults.map(loc => ({
        label: `${loc.location_name} (${loc.location_code || 'N/A'}) - ${loc.city || ''}, ${loc.country || ''}`,
        value: loc.location_name,
        original: loc
      }));
    } catch (e) {
      console.error('LocationSelect Exception in loadLocations:', e);
      return [];
    }
  }, []);

  const handleLocationCreated = (newLocation: any) => {
    onChange(newLocation.location_name);
    setDisplayValue(newLocation.location_name);
    setSelectedLocation(newLocation);
  };

  const handleLocationUpdated = (updatedLocation: any) => {
    onChange(updatedLocation.location_name);
    const label = `${updatedLocation.location_name} (${updatedLocation.location_code || 'N/A'}) - ${updatedLocation.city || ''}, ${updatedLocation.country || ''}`;
    setDisplayValue(label);
    setSelectedLocation(updatedLocation);
    // Force a re-render of the options if possible, but AsyncCombobox handles internal state
  };

  const handleDeleteLocation = async () => {
    if (!selectedLocation) return;
    
    try {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('ports_locations')
        .update({ is_active: false })
        .eq('id', selectedLocation.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Location deleted successfully."
      });
      
      onChange(""); // Clear selection
      setDisplayValue("");
      setSelectedLocation(null);
    } catch (error: any) {
      console.error('Error deleting location:', error);
      toast({
        title: "Error",
        description: "Failed to delete location.",
        variant: "destructive"
      });
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  return (
    <>
      <div className="flex gap-2 w-full items-center">
        <AsyncCombobox
          value={value}
          displayValue={displayValue}
          onChange={(val, option) => {
            onChange(val);
            if (option) {
              setDisplayValue(option.label);
              setSelectedLocation(option.original);
            } else {
                // Allow custom values if needed, or reset display value
                setDisplayValue(val);
                if (!val) setSelectedLocation(null);
            }
          }}
          loader={loadLocations}
          placeholder={placeholder}
          className={cn("flex-1 w-auto min-w-0", className)}
          disabled={disabled}
          onCreate={() => setCreateDialogOpen(true)}
          createLabel="Create new location"
        />

        {selectedLocation && (
          <div className="flex gap-1 shrink-0">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-8" onClick={() => setEditDialogOpen(true)}>
                    <Pencil className="h-4 w-4 text-muted-foreground hover:text-primary" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit Location</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-8" onClick={() => setDeleteDialogOpen(true)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete Location</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>

      <CreateLocationDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen}
        onLocationCreated={handleLocationCreated}
      />

      <EditLocationDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        location={selectedLocation}
        onLocationUpdated={handleLocationUpdated}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will delete the location "{selectedLocation?.location_name}". This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLocation} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
