import React, { useState, useEffect } from 'react';
import { AsyncCombobox, ComboOption } from '@/components/ui/async-combobox';
import { useCRM } from '@/hooks/useCRM';
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
  onChange: (value: string, location?: any) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  preloadedPorts?: any[];
}

export function LocationSelect({
  value,
  onChange,
  placeholder = "Select city/port...",
  className,
  disabled,
  preloadedPorts = [],
}: LocationSelectProps) {
  const [displayValue, setDisplayValue] = useState<string>("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const { toast } = useToast();
  const { scopedDb } = useCRM();

  useEffect(() => {
    if (!value) {
      setDisplayValue("");
      setSelectedLocation(null);
    } else {
      // If the value is present but the full location object is not, fetch it.
      // This is crucial for initializing the component with a pre-existing value.
      if (!selectedLocation || selectedLocation.location_name !== value) {
        fetchLocationDetails(value);
      }
    }
  }, [value]);

  // This effect synchronizes the display value when the selected location object is updated.
  useEffect(() => {
    if (selectedLocation) {
      const { location_name, location_code, city, country } = selectedLocation;
      const label = `${location_name} (${location_code || 'N/A'}) - ${city || ''}${city && country ? ', ' : ''}${country}`;
      setDisplayValue(label);
    }
    // Do not automatically clear displayValue here; clearing should be driven by the `value` prop.
  }, [selectedLocation]);

  const fetchLocationDetails = async (name: string) => {
    // Check preloaded ports first (Primary Source)
    if (preloadedPorts && preloadedPorts.length > 0) {
      const found = preloadedPorts.find(p => 
        (p.location_name && p.location_name.toLowerCase() === name.toLowerCase()) || 
        (p.name && p.name.toLowerCase() === name.toLowerCase())
      );
      
      if (found) {
        if (process.env.NODE_ENV === 'development') {
          console.debug('[LocationSelect] Found location in preloaded data:', name);
        }
        setSelectedLocation({
          id: found.id,
          location_name: found.location_name || found.name,
          location_code: found.location_code || found.code,
          location_type: found.location_type || found.type,
          country: found.country,
          city: found.city
        });
        return;
      }
    }

    // Fallback: Use RPC to search for the location to support both ports and cities
    try {
      console.debug('[LocationSelect] Fetching location details via RPC for:', name);
      const { data, error } = await scopedDb.rpc('search_locations', {
        search_text: name,
        limit_count: 1
      });
      
      if (error) {
        console.error('[LocationSelect] RPC Error fetching location details:', error);
        // Implement retry logic here if needed, or show toast
        return;
      }

      if (data && data.length > 0) {
        // Map RPC result to the expected format

        const loc = data[0];
        setSelectedLocation({
          id: loc.id,
          location_name: loc.location_name,
          location_code: loc.location_code,
          location_type: loc.location_type,
          country: loc.country,
          city: loc.city
        });
      }
    } catch (e) {
      console.error('Error fetching location details:', e);
    }
  };

  const loadLocations = React.useCallback(async (search: string): Promise<ComboOption[]> => {
    try {
      // Optimization: Use preloaded ports if available (Client-side filtering)
      if (preloadedPorts && preloadedPorts.length > 0) {
        const searchLower = (search || '').toLowerCase().trim();
        
        // Performance Monitoring: Start timer
        const startTime = performance.now();

        // If search is empty, return top 20 (or popular ones)
        // If search has value, filter by name, code, city, country
        const filtered = preloadedPorts.filter(p => {
           if (!searchLower) return true;
           const name = (p.location_name || p.name || '').toLowerCase();
           const code = (p.location_code || p.code || '').toLowerCase();
           const city = (p.city || '').toLowerCase();
           const country = (p.country || '').toLowerCase();
           
           // Robust search logic: Check all relevant fields
           return name.includes(searchLower) || 
                  code.includes(searchLower) || 
                  city.includes(searchLower) ||
                  country.includes(searchLower);
        }).slice(0, 50);

        // Performance Monitoring: End timer
        const endTime = performance.now();
        if (process.env.NODE_ENV === 'development') {
           console.debug(`[LocationSelect] Client-side search for "${search}" took ${endTime - startTime}ms. Found ${filtered.length} results.`);
        }

        return filtered.map(loc => {
           const name = loc.location_name || loc.name || 'Unknown Location';
           const code = loc.location_code || loc.code || 'N/A';
           const city = loc.city || '';
           const country = loc.country || '';
           
           return {
             label: `${name} (${code}) - ${city}${city && country ? ', ' : ''}${country}`,
             value: name,
             original: loc
           };
        });
      }

      if (!search || search.length < 2) return [];
      
      console.log('LocationSelect searching for:', search);
      
      // Run both RPC and direct query in parallel for best results
      const [rpcResponse, fallbackResponse] = await Promise.all([
        scopedDb.rpc('search_locations', {
          search_text: search || '',
          limit_count: 20
        }),
        scopedDb
          .from('ports_locations', true)
          .select('id, location_name, location_code, location_type, country, city')
          .or(`location_name.ilike.%${search}%,location_code.ilike.%${search}%,city.ilike.%${search}%`)
          .limit(20)
      ]);

      const { data: rpcData, error: rpcError } = rpcResponse;
      const { data: fallbackData, error: fallbackError } = fallbackResponse;

      if (process.env.NODE_ENV === 'development') {
         console.log('LocationSelect loadLocations search:', search);
         console.log('RPC Data:', rpcData, 'Error:', rpcError);
         console.log('Fallback Data:', fallbackData, 'Error:', fallbackError);
      }

      if (rpcError) {
        console.warn('LocationSelect RPC error:', rpcError);
      }

      if (fallbackError) {
        console.error('LocationSelect fallback query error:', fallbackError);
      }

      const combinedResults: any[] = [];
      const seenIds = new Set<string>();

      // Helper to add unique locations
      const addLocation = (item: any) => {
           const id = item.id;
           // Handle potential different casing or missing fields
           let locName = item.location_name || item.locationName || item.name || item.city || '';
           
           // Explicit check for "undefined" string or null
           // Also trim whitespace to catch " " or empty strings
           locName = String(locName).trim();
           if (!locName || locName.toLowerCase() === 'undefined' || locName.toLowerCase() === 'null' || locName.toLowerCase() === 'unknown') {
              // Try to construct from city/country if name is missing or invalid
              if (item.city) {
                  locName = item.city;
                  if (item.country) locName += `, ${item.country}`;
              } else {
                  if (process.env.NODE_ENV === 'development') {
                      console.warn('LocationSelect skipping invalid item:', item);
                  }
                  return; // Skip invalid items
              }
           }
           
           const locCode = item.location_code || item.locationCode || item.code || '';
           const locType = item.location_type || item.locationType || item.type || 'unknown';
           const country = item.country || item.country_name || '';
           const city = item.city || item.city_name || '';

           // Use Name as the key for deduplication because the output value must be the Name (string)
           // If we have multiple locations with same name, we only show one (first one wins)
           // This prevents duplicate keys in the dropdown and ensures deterministic selection
           const key = locName.toLowerCase();
           
           if (!seenIds.has(key)) {
               seenIds.add(key);
               combinedResults.push({
                  id: item.id || key, // Keep original ID if available
                  location_name: locName,
                  location_code: locCode,
                  location_type: locType,
                  country: country,
                  city: city
               });
           }
      };

      if (rpcData && Array.isArray(rpcData)) {
          rpcData.forEach(addLocation);
      }

      if (fallbackData && Array.isArray(fallbackData)) {
          fallbackData.forEach(addLocation);
      }

      console.log('LocationSelect found results:', combinedResults.length);

      return combinedResults.map(loc => {
        // Double check name before mapping
        const name = loc.location_name || 'Unknown Location';
        return {
          label: `${name} (${loc.location_code || 'N/A'}) - ${loc.city || ''}, ${loc.country || ''}`,
          value: name, // Use Name as value since LegManager expects string
          original: {
            id: loc.id,
            location_name: name,
            location_code: loc.location_code,
            location_type: loc.location_type,
            country: loc.country,
            city: loc.city
          }
        };
      });
    } catch (e) {
      console.error('LocationSelect Exception in loadLocations:', e);
      return [];
    }
  }, [scopedDb]);

  const handleLocationCreated = (newLocation: any) => {
    onChange(newLocation.location_name, newLocation);
    setDisplayValue(newLocation.location_name);
    setSelectedLocation(newLocation);
  };

  const handleLocationUpdated = (updatedLocation: any) => {
    onChange(updatedLocation.location_name, updatedLocation);
    const label = `${updatedLocation.location_name} (${updatedLocation.location_code || 'N/A'}) - ${updatedLocation.city || ''}, ${updatedLocation.country || ''}`;
    setDisplayValue(label);
    setSelectedLocation(updatedLocation);
    // Force a re-render of the options if possible, but AsyncCombobox handles internal state
  };

  const handleDeleteLocation = async () => {
    if (!selectedLocation) return;
    
    try {
      // Soft delete by setting is_active to false
      const { error } = await scopedDb
        .from('ports_locations', true)
        .update({ is_active: false })
        .eq('id', selectedLocation.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Location deleted successfully."
      });
      
      onChange("", null); // Clear selection
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
            onChange(val, option?.original);
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
                  <Button variant="ghost" size="icon" className="h-10 w-8" onClick={() => setEditDialogOpen(true)} aria-label="Edit Location">
                    <Pencil className="h-4 w-4 text-muted-foreground hover:text-primary" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit Location</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-8" onClick={() => setDeleteDialogOpen(true)} aria-label="Delete Location">
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
