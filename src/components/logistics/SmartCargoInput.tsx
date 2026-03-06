import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Search, Package, AlertCircle, FolderSearch, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { VisualHTSBrowser } from '@/components/hts/VisualHTSBrowser';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { useCRM } from '@/hooks/useCRM';
import { Badge } from '@/components/ui/badge';

export interface CommoditySelection {
  description: string;
  aes_hts_id?: string;
  hts_code?: string;
  cargo_type_id?: string;
  unit_value?: number;
  hazmat_class?: string;
  master_commodity_id?: string;
}

interface SmartCargoInputProps {
  onSelect: (selection: CommoditySelection) => void;
  className?: string;
  placeholder?: string;
  value?: string;
  onInputChange?: (value: string) => void;
  error?: boolean;
}

export function SmartCargoInput({ onSelect, className, placeholder = "Search commodities or HTS codes...", value, onInputChange, error }: SmartCargoInputProps) {
  const { scopedDb } = useCRM();
  const [open, setOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value || '');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Sync internal state with external value prop
  useEffect(() => {
    if (!open && value !== undefined && value !== searchTerm) {
      setSearchTerm(value);
    }
  }, [value, open, searchTerm]);

  const updateSearchTerm = (nextValue: string) => {
    setSearchTerm(nextValue);
    onInputChange?.(nextValue);
  };

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Query Master Commodities (Tenant Catalog)
  const { data: masterCommodities, isFetching: loadingMaster, isError: isMasterError } = useQuery({
    queryKey: ['master_commodities', debouncedSearch],
    queryFn: async () => {
      if (debouncedSearch.length < 2) return [];

      const fetchMasterFallback = async () => {
        const { data: fallbackData, error: fallbackError } = await scopedDb
          .from('master_commodities')
          .select('id, name, sku, description, aes_hts_id, default_cargo_type_id, unit_value, hazmat_class, aes_hts_codes(hts_code)')
          .or(`name.ilike.%${debouncedSearch}%,sku.ilike.%${debouncedSearch}%,description.ilike.%${debouncedSearch}%`)
          .limit(5);

        if (fallbackError) {
          console.error('Master commodity fallback failed:', fallbackError);
          throw fallbackError;
        }

        return (fallbackData || []).map((item: any) => ({
          ...item,
          hts_code: item.aes_hts_codes?.hts_code
        }));
      };

      const { data, error } = await scopedDb.rpc('search_master_commodities', {
        p_search_term: debouncedSearch,
        p_limit: 5
      });
      if (error) {
        console.warn('Master commodity RPC failed, falling back to table search:', error);
        return fetchMasterFallback();
      }

      if (!Array.isArray(data) || data.length === 0) {
        return fetchMasterFallback();
      }

      return data;
    },
    enabled: debouncedSearch.length >= 2,
    retry: 2,
    staleTime: 300000, // 5 minutes
  });

  // Query HTS Codes (Global Dictionary)
  const { data: htsCodes, isFetching: loadingHTS, isError: isHTSError } = useQuery({
    queryKey: ['hts_codes', debouncedSearch],
    queryFn: async () => {
      if (debouncedSearch.length < 2) return [];

      const fetchHtsFallback = async () => {
        const { data: fallbackData, error: fallbackError } = await scopedDb
          .from('aes_hts_codes')
          .select('id, hts_code, description, category')
          .or(`hts_code.ilike.%${debouncedSearch}%,description.ilike.%${debouncedSearch}%`)
          .limit(10);

        if (fallbackError) {
          console.error('Fallback search failed:', fallbackError);
          throw fallbackError;
        }

        return fallbackData || [];
      };

      // Use the Smart Search RPC (Fuzzy Matching)
      const { data, error } = await scopedDb.rpc('search_hts_codes_smart', {
        p_search_term: debouncedSearch,
        p_limit: 10
      });

      if (error) {
        console.warn('Smart search failed, falling back to simple search:', error);
        return fetchHtsFallback();
      }

      if (!Array.isArray(data) || data.length === 0) {
        return fetchHtsFallback();
      }

      return data;
    },
    enabled: debouncedSearch.length >= 2,
    retry: 2,
    staleTime: 300000, // 5 minutes
  });

  const handleSelectMaster = (item: any) => {
    onSelect({
      description: item.name,
      aes_hts_id: item.aes_hts_id,
      hts_code: item.hts_code,
      cargo_type_id: item.default_cargo_type_id,
      unit_value: item.unit_value,
      hazmat_class: item.hazmat_class,
      master_commodity_id: item.id,
    });
    updateSearchTerm(item.name);
    setOpen(false);
  };

  const handleSelectHTS = (item: any) => {
    onSelect({
      description: item.description,
      aes_hts_id: item.id,
      hts_code: item.hts_code,
    });
    updateSearchTerm(`${item.description} - ${item.hts_code}`);
    setOpen(false);
  };

  const handleBrowserSelect = (selection: { code: string; description: string; id: string }) => {
    onSelect({
      description: selection.description,
      aes_hts_id: selection.id,
      hts_code: selection.code,
    });
    setBrowserOpen(false);
    updateSearchTerm(`${selection.description} - ${selection.code}`);
  };

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  return (
    <div className={cn("flex gap-2 w-full", className)}>
      <Popover open={open} onOpenChange={(isOpen) => {
        // If closing and search term has changed, commit it as a custom selection
        if (!isOpen && searchTerm !== value) {
          onSelect({ description: searchTerm });
        }
        setOpen(isOpen);
      }}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={!!error}
            className={cn(
              "flex-1 justify-between text-left font-normal", 
              !searchTerm && "text-muted-foreground",
              error && "border-destructive focus-visible:ring-destructive"
            )}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              const isPrintable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
              if (isPrintable) {
                setOpen(true);
                updateSearchTerm(searchTerm + e.key);
                e.preventDefault();
              } else if (e.key === 'Backspace') {
                setOpen(true);
                updateSearchTerm(searchTerm.slice(0, Math.max(0, searchTerm.length - 1)));
                e.preventDefault();
              } else if (e.key === 'Escape') {
                setOpen(false);
              }
            }}
            onPaste={(e) => {
              const text = e.clipboardData.getData('text');
              if (text) {
                setOpen(true);
                updateSearchTerm(text);
                e.preventDefault();
              }
            }}
          >
            {searchTerm || placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[500px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput 
              placeholder="Type to search..." 
              value={searchTerm}
              onValueChange={updateSearchTerm}
              ref={inputRef as any}
            />
            <CommandList>
              {(loadingMaster || loadingHTS) && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Searching catalog...
                </div>
              )}

              {(isMasterError && isHTSError) && !loadingMaster && !loadingHTS && (
                <div className="p-2 text-xs text-red-500 bg-red-50 flex items-center gap-2 rounded-md m-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Search encountered an issue. You can still use a custom description.</span>
                </div>
              )}
              
              {!loadingMaster && !loadingHTS && debouncedSearch.length < 2 && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Type at least 2 characters...
                </div>
              )}
              
              {masterCommodities && masterCommodities.length > 0 && (
                <CommandGroup heading="My Catalog (Master Commodities)">
                  {masterCommodities.map((item: any) => (
                    <CommandItem
                      key={item.id}
                      value={item.id}
                      onSelect={() => handleSelectMaster(item)}
                      className="flex flex-col items-start gap-1 py-3"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Package className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">{item.name}</span>
                        {item.sku && <Badge variant="outline" className="text-xs">{item.sku}</Badge>}
                      </div>
                      {item.description && (
                        <span className="text-xs text-muted-foreground line-clamp-1 pl-6">
                          {item.description}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {(masterCommodities?.length ?? 0) > 0 && (htsCodes?.length ?? 0) > 0 && <CommandSeparator />}

              {htsCodes && htsCodes.length > 0 && (
                <CommandGroup heading="Global HTS / Schedule B Codes">
                  {htsCodes.map((item: any) => (
                    <CommandItem
                      key={item.id}
                      value={item.id}
                      onSelect={() => handleSelectHTS(item)}
                      className="flex flex-col items-start gap-1 py-3"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Search className="h-4 w-4 text-green-500" />
                        <span className="font-mono font-medium">{item.hts_code}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{item.category?.substring(0, 30)}...</span>
                      </div>
                      <span className="text-xs text-muted-foreground line-clamp-2 pl-6">
                        {item.description}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {searchTerm && !loadingMaster && !loadingHTS && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Custom">
                    <CommandItem
                      onSelect={() => {
                        onSelect({ description: searchTerm });
                        setOpen(false);
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <Plus className="h-4 w-4" /> Use "{searchTerm}"
                      </span>
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Button 
        variant="outline" 
        size="icon" 
        onClick={() => setBrowserOpen(true)}
        title="Browse HTS Codes"
      >
        <FolderSearch className="h-4 w-4" />
      </Button>

      <Dialog open={browserOpen} onOpenChange={setBrowserOpen}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Visual HTS Browser</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden min-h-0">
            <VisualHTSBrowser onSelect={handleBrowserSelect} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
