import * as React from "react"
import { Check, ChevronsUpDown, Plane, Ship, Truck, Warehouse, Building2, MapPin, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useCRM } from "@/hooks/useCRM"
import { Badge } from "@/components/ui/badge"
import { useDebounce } from "@/hooks/useDebounce"
import * as Sentry from "@sentry/react"

interface Location {
  id: string;
  location_name: string;
  location_code: string;
  location_type: string;
  country: string;
  city: string;
}

// RPC Result Interface
interface RPCLocation {
  id: string;
  location_name: string;
  location_code: string;
  location_type: string;
  country: string;
  city: string;
}

interface LocationAutocompleteProps {
  value?: string;
  onChange: (value: string, location?: Location) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  preloadedLocations?: Location[];
}

export const LocationAutocomplete = React.memo(function LocationAutocomplete({
  value,
  onChange,
  placeholder = "Search location...",
  className,
  disabled = false,
  preloadedLocations
}: LocationAutocompleteProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")
  const [locations, setLocations] = React.useState<Location[]>([])
  const [loading, setLoading] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  const [selectedLocation, setSelectedLocation] = React.useState<Location | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const isSelecting = React.useRef(false)
  
  const { scopedDb, user } = useCRM()
  const debouncedSearch = useDebounce(inputValue, 300)
  const [cache, setCache] = React.useState<Record<string, Location[]>>({})
  const PAGE_SIZE = 50
  const [page, setPage] = React.useState(0)
  const [hasMore, setHasMore] = React.useState(false)

  const normalizeLocation = React.useCallback((item: any): Location | null => {
    if (!item) return null

    const id = String(item.id || '').trim()
    const location_name = String(
      item.location_name ?? item.locationName ?? item.name ?? item.city ?? ''
    ).trim()
    if (!location_name || location_name === 'undefined' || location_name === 'null') return null

    const location_code = String(item.location_code ?? item.locationCode ?? item.code ?? '').trim()
    const location_type = String(item.location_type ?? item.locationType ?? item.type ?? 'unknown').trim()
    const country = String(item.country ?? item.country_name ?? item.countryName ?? '').trim()
    const city = String(item.city ?? item.city_name ?? item.cityName ?? '').trim()

    return {
      id: id || `${location_name}-${location_code}`,
      location_name,
      location_code,
      location_type,
      country,
      city,
    }
  }, [])

  React.useEffect(() => {
    if (!open) {
        setLocations([])
        setPage(0)
        setHasMore(false)
    }
  }, [open])

  React.useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  // Sync selectedLocation with value prop
  React.useEffect(() => {
    let isMounted = true;

    const syncLocation = async () => {
      const valueTrimmed = String(value || '').trim()
      const valueLower = valueTrimmed.toLowerCase()

      const codeFromLabel = valueTrimmed.match(/\(([^)]+)\)\s*$/)?.[1]?.trim() || ''
      const codeLower = codeFromLabel.toLowerCase()
      const nameFromLabel = valueTrimmed.replace(/\s*\([^)]+\)\s*$/, '').trim()
      const nameFromLabelLower = nameFromLabel.toLowerCase()

      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          valueTrimmed
        )

      if (valueTrimmed) {
        if (isUuid) {
          if (selectedLocation?.id && selectedLocation.id.trim().toLowerCase() === valueLower) return

          try {
            const { data, error } = await scopedDb
              .from('ports_locations', true)
              .select('id, location_name, location_code, location_type, country, city')
              .in('id', [valueTrimmed])
              .maybeSingle()

            if (error) {
              Sentry.captureException(error, {
                tags: { feature: 'quick_quote', component: 'LocationAutocomplete', stage: 'sync-by-id' },
              })
              return
            }

            const normalized = normalizeLocation(data)
            if (isMounted && normalized) {
              setSelectedLocation(normalized)
            }
            return
          } catch (e) {
            if (isMounted) {
              Sentry.captureException(e, {
                tags: { feature: 'quick_quote', component: 'LocationAutocomplete', stage: 'sync-by-id' },
              })
            }
            return
          }
        }

        // 1. Check preloaded locations (fastest)
        if (preloadedLocations && preloadedLocations.length > 0) {
          const match = preloadedLocations.find((l: any) => {
            const normalized = normalizeLocation(l)
            if (!normalized) return false
            const nLower = normalized.location_name.toLowerCase()
            const cLower = normalized.location_code.toLowerCase()
            if (nameFromLabelLower && nLower === nameFromLabelLower) return true
            if (valueLower && nLower === valueLower) return true
            if (codeLower && cLower === codeLower) return true
            if (valueLower && cLower === valueLower) return true
            return false
          }) as any;
          if (match) {
            const normalized = normalizeLocation(match)
            if (isMounted && normalized) {
              const isSame =
                selectedLocation &&
                selectedLocation.location_name.toLowerCase() === normalized.location_name.toLowerCase() &&
                selectedLocation.location_code.toLowerCase() === normalized.location_code.toLowerCase()
              if (!isSame) setSelectedLocation(normalized)
            }
            return;
          }
        }
        
        // 2. If not in preloaded and no selectedLocation (or mismatch), fetch via RPC
        if (!selectedLocation || selectedLocation.location_name.toLowerCase() !== valueLower) {
             try {
                 // Only fetch if value looks like a real location (e.g. > 2 chars)
                 if (valueTrimmed.length < 2) return;

                 const { data, error } = await scopedDb.rpc('search_locations', {
                     search_text: valueTrimmed,
                     limit_count: 1
                 });
                 
                 if (error) {
                   Sentry.captureException(error, {
                     tags: { feature: 'quick_quote', component: 'LocationAutocomplete', stage: 'sync-by-rpc' },
                   })
                   return
                 }

                 if (isMounted && data && data.length > 0) {
                     const normalized = normalizeLocation(data[0]);
                     if (!normalized) return

                     const nLower = normalized.location_name.toLowerCase()
                     const cLower = normalized.location_code.toLowerCase()
                     const isStrictMatch =
                       (nameFromLabelLower && nLower === nameFromLabelLower) ||
                       (valueLower && nLower === valueLower) ||
                       (codeLower && cLower === codeLower) ||
                       (valueLower && cLower === valueLower)

                     if (isStrictMatch) setSelectedLocation(normalized);
                 }
             } catch (e) {
                 if (isMounted) {
                    Sentry.captureException(e, { tags: { feature: 'quick_quote', component: 'LocationAutocomplete', stage: 'sync-by-rpc' } })
                 }
             }
        }
      } else if (!value && selectedLocation) {
          if (isSelecting.current) {
              isSelecting.current = false;
          } else {
              if (isMounted) setSelectedLocation(null);
          }
      }
    };

    syncLocation();
    
    return () => {
        isMounted = false;
    };
  }, [value, preloadedLocations, selectedLocation, scopedDb, normalizeLocation]);

  // Initial load when dropdown opens with empty search
  React.useEffect(() => {
    const initialLoad = async () => {
      if (!open || (inputValue && inputValue.length >= 2)) return
      
      if (preloadedLocations && preloadedLocations.length > 0) {
        setLocations(preloadedLocations.slice(0, PAGE_SIZE));
        setHasMore(preloadedLocations.length > PAGE_SIZE);
        setPage(1);
        return;
      }
      
      setLoading(true)
      setErrorMsg(null)
      try {
        const { data, error } = await scopedDb
          .from('ports_locations', true)
          .select('id, location_name, location_code, location_type, country, city')
          .order('location_name', { ascending: true })
          .range(0, PAGE_SIZE - 1)
        if (error) {
          console.error('Initial ports load failed:', error)
          Sentry.captureException(error, { tags: { feature: 'quick_quote', component: 'LocationAutocomplete' } })
          setErrorMsg('Failed to load ports.')
          setLocations([])
          setHasMore(false)
          return
        }
        const list = (data || []) as Location[]
        setLocations(list)
        setPage(1)
        setHasMore(list.length === PAGE_SIZE)
      } catch (err) {
        console.error('Initial ports load error:', err)
        Sentry.captureException(err as any, { tags: { feature: 'quick_quote', component: 'LocationAutocomplete' } })
        setErrorMsg('Network error while loading ports.')
        setLocations([])
        setHasMore(false)
      } finally {
        setLoading(false)
      }
    }
    initialLoad()
  }, [open, inputValue, scopedDb, preloadedLocations])

  React.useEffect(() => {
    const fetchLocations = async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) {
        // Keep initial list if loaded
        setErrorMsg(null)
        return
      }

      if (cache[debouncedSearch]) {
        setLocations(cache[debouncedSearch])
        setErrorMsg(null)
        return
      }

      if (preloadedLocations && preloadedLocations.length > 0) {
        const searchLower = debouncedSearch.toLowerCase();
        const filtered = preloadedLocations.filter(loc => 
          (loc.location_name && loc.location_name.toLowerCase().includes(searchLower)) ||
          (loc.location_code && loc.location_code.toLowerCase().includes(searchLower)) ||
          (loc.city && loc.city.toLowerCase().includes(searchLower)) ||
          (loc.country && loc.country.toLowerCase().includes(searchLower))
        ).slice(0, 50); // Limit results for performance
        
        if (filtered.length > 0) {
            setLocations(filtered);
            setHasMore(false); // No pagination for filtered results
            setCache(prev => ({ ...prev, [debouncedSearch]: filtered }));
            return;
        }
        // If no matches in preloaded, fall through to RPC/DB search
      }

      setLoading(true)
      setErrorMsg(null)
      try {
        // Run both RPC and direct query in parallel for best results
        const [rpcResponse, fallbackResponse] = await Promise.all([
          scopedDb.rpc('search_locations', { search_text: debouncedSearch, limit_count: 10 }),
          scopedDb
            .from('ports_locations', true)
            .select('id, location_name, location_code, location_type, country, city')
            .or(`location_name.ilike.%${debouncedSearch}%,location_code.ilike.%${debouncedSearch}%,city.ilike.%${debouncedSearch}%`)
            .limit(10)
        ]);

        const { data: rpcData, error: rpcError } = rpcResponse;
        const { data: fallbackData, error: fbError } = fallbackResponse;

        if (rpcError) {
          console.error('Error fetching locations via RPC:', rpcError)
          // Don't fail completely if RPC fails, just rely on fallback
          Sentry.captureMessage('Location search RPC failed', {
            level: 'warning',
            tags: { feature: 'quick_quote', component: 'LocationAutocomplete' },
          })
        }

        if (fbError) {
             console.error('Fallback query failed:', fbError)
        }

        // Combine results
        const combinedResults: Location[] = [];
        const seenIds = new Set<string>();

        // Helper to add unique locations
        const addLocation = (item: any) => {
             const id = item.id;
             // Handle potential different casing or missing fields
             let locName = item.location_name || item.locationName || item.name || item.city || '';
             
             // Explicit check for "undefined" string or null
             if (!locName || locName === 'undefined' || locName === 'null') {
                // Try to construct from city/country if name is missing
                if (item.city) {
                    locName = item.city;
                    if (item.country) locName += `, ${item.country}`;
                } else {
                    return; // Skip invalid items
                }
             }
             
             const locCode = item.location_code || item.locationCode || item.code || '';
             const locType = item.location_type || item.locationType || item.type || 'unknown';
             const country = item.country || item.country_name || '';
             const city = item.city || item.city_name || '';

             // Use a composite key of name+code to deduplicate if ID is missing or generated
             const key = id || `${locName}-${locCode}`;
             
             if (!seenIds.has(key)) {
                 seenIds.add(key);
                 combinedResults.push({
                    id: item.id || key, // Fallback ID
                    location_name: locName,
                    location_code: locCode,
                    location_type: locType,
                    country: country,
                    city: city
                 });
             }
        };

        if (rpcData && Array.isArray(rpcData)) rpcData.forEach(addLocation);
        if (fallbackData && Array.isArray(fallbackData)) fallbackData.forEach(addLocation);
        
        setLocations(combinedResults);
        
        if (combinedResults.length === 0) {
            setErrorMsg(null); // No results found, but no error
        } else {
             setCache(prev => ({ ...prev, [debouncedSearch]: combinedResults }));
        }

      } catch (err) {
        console.error('Failed to fetch locations:', err)
        setErrorMsg('Network error. Showing fallback results if available.')
        Sentry.captureException(err, {
          tags: { feature: 'quick_quote', component: 'LocationAutocomplete' },
        })
        const { data: fallback } = await scopedDb
          .from('ports_locations', true)
          .select('id, location_name, location_code, location_type, country, city')
          .or(`location_name.ilike.%${debouncedSearch}%,location_code.ilike.%${debouncedSearch}%,city.ilike.%${debouncedSearch}%`)
          .limit(10)
          
        const mappedFallback: Location[] = (fallback || []).map((item: any) => ({
             id: item.id,
             location_name: item.location_name || item.name || 'Unknown Location',
             location_code: item.location_code || item.code || '',
             location_type: item.location_type || item.type || 'unknown',
             country: item.country || item.country_name || '',
             city: item.city || item.city_name || ''
        }))
        setLocations(mappedFallback)
      } finally {
        setLoading(false)
      }
    }

    fetchLocations()
  }, [debouncedSearch, scopedDb, user, preloadedLocations])

  const getLocationIcon = (type: string) => {
    const safeType = String(type || '').toLowerCase();
    switch (safeType) {
      case 'seaport': return <Ship className="h-4 w-4" />
      case 'airport': return <Plane className="h-4 w-4" />
      case 'inland_port': return <Truck className="h-4 w-4" />
      case 'warehouse': return <Warehouse className="h-4 w-4" />
      case 'terminal': return <Building2 className="h-4 w-4" />
      case 'city': return <MapPin className="h-4 w-4" />
      default: return <MapPin className="h-4 w-4" />
    }
  }

  // Display logic: Use selectedLocation if available and matches value, otherwise just show value
  const selectedNameLower = (selectedLocation?.location_name || '').trim().toLowerCase()
  const selectedCodeLower = (selectedLocation?.location_code || '').trim().toLowerCase()
  const valueLower = (value || '').trim().toLowerCase()

  const valueLooksUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      valueLower
    )

  const shouldUseSelected =
    (!!selectedLocation && !valueLower) ||
    (!!selectedLocation && valueLooksUuid) ||
    (!!selectedLocation && (valueLower === selectedNameLower || valueLower === selectedCodeLower))

  const displayValue = shouldUseSelected
    ? `${selectedLocation!.location_name} ${selectedLocation!.location_code ? `(${selectedLocation!.location_code})` : ''}`
    : value || ""

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between text-left font-normal", !value && !selectedLocation && "text-muted-foreground", className)}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (disabled) return
            const isPrintable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey
            if (isPrintable) {
              setOpen(true)
              setInputValue((prev) => prev + e.key)
              e.preventDefault()
            } else if (e.key === 'Backspace') {
              setOpen(true)
              setInputValue((prev) => prev.slice(0, Math.max(0, prev.length - 1)))
              e.preventDefault()
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
          onPaste={(e) => {
            if (disabled) return
            const text = e.clipboardData.getData('text')
            if (text) {
              setOpen(true)
              setInputValue(text)
              e.preventDefault()
            }
          }}
        >
          <span className="truncate">
            {displayValue || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}> 
          <CommandInput 
            placeholder="Search port, airport, city..." 
            value={inputValue}
            onValueChange={(val) => {
              setInputValue(val)
              // Allow free text input by propagating change immediately
              // If a location is selected later, onSelect will overwrite this
              onChange(val, undefined)
              setSelectedLocation(null)
            }}
            ref={inputRef as any}
          />
          <CommandList>
            {loading && (
                <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                </div>
            )}
            {!loading && locations.length === 0 && debouncedSearch.length >= 2 && (
              <CommandEmpty>{errorMsg || 'No locations found.'}</CommandEmpty>
            )}
            {!loading && debouncedSearch.length < 2 && (
                <div className="p-4 text-sm text-muted-foreground text-center">
                    {locations.length === 0 ? 'Type at least 2 characters to search...' : `Showing ${locations.length} ports. Type to refine.`}
                </div>
            )}
            <CommandGroup>
              {locations.map((location, index) => (
                <CommandItem
                  key={location.id || index}
                  value={location.location_name || 'Unknown'}
                  onSelect={() => {
                    isSelecting.current = true
                    setSelectedLocation(location)
                    onChange(location.location_name, location)
                    setOpen(false)
                  }}
                >
                  <div className="flex items-center gap-2 w-full">
                    {getLocationIcon(location.location_type)}
                    <div className="flex flex-col flex-1 overflow-hidden">
                        <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{location.location_name || 'Unknown Location'}</span>
                            {location.location_code && (
                                <Badge variant="secondary" className="text-[10px] px-1 py-0 h-5">
                                    {location.location_code}
                                </Badge>
                            )}
                            {location.id && location.location_code && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 h-5">
                                    ID verified
                                </Badge>
                            )}
                        </div>
                        <span className="text-xs text-muted-foreground truncate">
                            {[location.city, location.country].filter(Boolean).join(", ")}
                        </span>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                        {String(location.location_type || 'unknown').replace('_', ' ')}
                    </Badge>
                  </div>
                  <Check
                    className={cn(
                      "ml-2 h-4 w-4",
                      (value || '').trim().toLowerCase() === (location.location_name || '').trim().toLowerCase()
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
              {!loading && debouncedSearch.length < 2 && hasMore && (
                <CommandItem
                  key="load-more"
                  value="load-more"
                  onSelect={async () => {
                    try {
                      setLoading(true)
                      const start = page * PAGE_SIZE
                      const end = start + PAGE_SIZE - 1
                      const { data, error } = await scopedDb
                        .from('ports_locations', true)
                        .select('id, location_name, location_code, location_type, country, city')
                        .order('location_name', { ascending: true })
                        .range(start, end)
                      if (error) {
                        console.error('Load more ports failed:', error)
                        Sentry.captureException(error, { tags: { feature: 'quick_quote', component: 'LocationAutocomplete' } })
                        setHasMore(false)
                        return
                      }
                      const next = (data || []) as Location[]
                      setLocations(prev => [...prev, ...next])
                      setPage(prev => prev + 1)
                      setHasMore(next.length === PAGE_SIZE)
                    } finally {
                      setLoading(false)
                    }
                  }}
                >
                  <div className="w-full text-center text-sm">Load more ports…</div>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
});
