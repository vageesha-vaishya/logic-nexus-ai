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
  name: string;
  code: string;
  type: string;
  country_name: string;
  city_name: string;
}

interface LocationAutocompleteProps {
  value?: string;
  onChange: (value: string, location?: Location) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function LocationAutocomplete({
  value,
  onChange,
  placeholder = "Search location...",
  className,
  disabled = false
}: LocationAutocompleteProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")
  const [locations, setLocations] = React.useState<Location[]>([])
  const [loading, setLoading] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  const [selectedLocation, setSelectedLocation] = React.useState<Location | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  
  const { supabase } = useCRM()
  const debouncedSearch = useDebounce(inputValue, 300)
  const [cache, setCache] = React.useState<Record<string, Location[]>>({})
  const PAGE_SIZE = 50
  const [page, setPage] = React.useState(0)
  const [hasMore, setHasMore] = React.useState(false)

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

  // Initial load when dropdown opens with empty search
  React.useEffect(() => {
    const initialLoad = async () => {
      if (!open || (inputValue && inputValue.length >= 2)) return
      setLoading(true)
      setErrorMsg(null)
      try {
        const { data, error } = await supabase
          .from('ports_locations')
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
  }, [open, inputValue, supabase])

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

      setLoading(true)
      setErrorMsg(null)
      try {
        const { data, error } = await supabase
          .rpc('search_locations', { search_text: debouncedSearch, limit_count: 10 })

        if (error) {
          console.error('Error fetching locations:', error)
          setErrorMsg('Error fetching locations. Showing fallback results.')
          Sentry.captureMessage('Location search RPC failed', {
            level: 'warning',
            tags: { feature: 'quick_quote', component: 'LocationAutocomplete' },
          })
          const { data: fallback, error: fbError } = await supabase
            .from('ports_locations')
            .select('id, location_name, location_code, location_type, country, city')
            .or(`location_name.ilike.%${debouncedSearch}%,location_code.ilike.%${debouncedSearch}%`)
            .limit(10)
          if (fbError) {
            console.error('Fallback query failed:', fbError)
            setLocations([])
            return
          }
          setLocations((fallback || []) as Location[])
          return
        }

        if (Array.isArray(data) && data.length > 0) {
          // Map RPC result to Location interface
          const mappedLocations: Location[] = (data as RPCLocation[]).map(item => ({
            id: item.id,
            location_name: item.name,
            location_code: item.code,
            location_type: item.type,
            country: item.country_name,
            city: item.city_name
          }))

          setLocations(mappedLocations)
          setCache(prev => ({ ...prev, [debouncedSearch]: mappedLocations }))
        } else {
          const { data: fallback } = await supabase
            .from('ports_locations')
            .select('id, location_name, location_code, location_type, country, city')
            .or(`location_name.ilike.%${debouncedSearch}%,location_code.ilike.%${debouncedSearch}%`)
            .limit(10)
          if (!fallback || fallback.length === 0) {
            setErrorMsg(null)
          }
          if (!Array.isArray(data) || data.length === 0) {
            Sentry.captureMessage('Location search RPC returned empty, using fallback', {
              level: 'info',
              tags: { feature: 'quick_quote', component: 'LocationAutocomplete' },
            })
          }
          setLocations((fallback || []) as Location[])
        }
      } catch (err) {
        console.error('Failed to fetch locations:', err)
        setErrorMsg('Network error. Showing fallback results if available.')
        Sentry.captureException(err, {
          tags: { feature: 'quick_quote', component: 'LocationAutocomplete' },
        })
        const { data: fallback } = await supabase
          .from('ports_locations')
          .select('id, location_name, location_code, location_type, country, city')
          .or(`location_name.ilike.%${debouncedSearch}%,location_code.ilike.%${debouncedSearch}%`)
          .limit(10)
        setLocations((fallback || []) as Location[])
      } finally {
        setLoading(false)
      }
    }

    fetchLocations()
  }, [debouncedSearch, supabase])

  const getLocationIcon = (type: string) => {
    switch (type?.toLowerCase()) {
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
  const displayValue = selectedLocation && selectedLocation.location_name === value
    ? `${selectedLocation.location_name} ${selectedLocation.location_code ? `(${selectedLocation.location_code})` : ''}`
    : value || ""

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between text-left font-normal", !value && "text-muted-foreground", className)}
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
            onValueChange={setInputValue}
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
              {locations.map((location) => (
                <CommandItem
                  key={location.id}
                  value={location.location_name}
                  onSelect={() => {
                    setSelectedLocation(location)
                    onChange(location.location_name, location)
                    setOpen(false)
                  }}
                >
                  <div className="flex items-center gap-2 w-full">
                    {getLocationIcon(location.location_type)}
                    <div className="flex flex-col flex-1 overflow-hidden">
                        <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{location.location_name}</span>
                            {location.location_code && (
                                <Badge variant="secondary" className="text-[10px] px-1 py-0 h-5">
                                    {location.location_code}
                                </Badge>
                            )}
                        </div>
                        <span className="text-xs text-muted-foreground truncate">
                            {[location.city, location.country].filter(Boolean).join(", ")}
                        </span>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                        {location.location_type.replace('_', ' ')}
                    </Badge>
                  </div>
                  <Check
                    className={cn(
                      "ml-2 h-4 w-4",
                      value === location.location_name ? "opacity-100" : "opacity-0"
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
                      const { data, error } = await supabase
                        .from('ports_locations')
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
}
