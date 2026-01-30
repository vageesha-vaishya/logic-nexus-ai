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
  const [selectedLocation, setSelectedLocation] = React.useState<Location | null>(null)
  
  const { supabase } = useCRM()
  const debouncedSearch = useDebounce(inputValue, 300)
  const [cache, setCache] = React.useState<Record<string, Location[]>>({})

  React.useEffect(() => {
    if (!open) {
        setLocations([])
    }
  }, [open])

  React.useEffect(() => {
    const fetchLocations = async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) {
        setLocations([])
        return
      }

      if (cache[debouncedSearch]) {
        setLocations(cache[debouncedSearch])
        return
      }

      setLoading(true)
      try {
        const { data, error } = await supabase
          .rpc('search_locations', { search_text: debouncedSearch, limit_count: 10 })

        if (error) {
          console.error('Error fetching locations:', error)
          return
        }

        if (data) {
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
        }
      } catch (err) {
        console.error('Failed to fetch locations:', err)
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
          />
          <CommandList>
            {loading && (
                <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                </div>
            )}
            {!loading && locations.length === 0 && debouncedSearch.length >= 2 && (
              <CommandEmpty>No locations found.</CommandEmpty>
            )}
            {!loading && debouncedSearch.length < 2 && (
                <div className="p-4 text-sm text-muted-foreground text-center">
                    Type at least 2 characters to search...
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
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
