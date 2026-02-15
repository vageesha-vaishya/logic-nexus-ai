import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Search, Package, AlertCircle, FolderSearch } from 'lucide-react';
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
}

export function SmartCargoInput({ onSelect, className, placeholder = "Search commodities or HTS codes..." }: SmartCargoInputProps) {
  const { supabase } = useCRM();
  const [open, setOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Query Master Commodities (Tenant Catalog)
  const { data: masterCommodities, isLoading: loadingMaster } = useQuery({
    queryKey: ['master_commodities', debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch) return [];
      const { data, error } = await supabase
        .from('master_commodities')
        .select('id, name, sku, description, aes_hts_id, default_cargo_type_id, unit_value, hazmat_class, aes_hts_codes(hts_code)')
        .or(`name.ilike.%${debouncedSearch}%,sku.ilike.%${debouncedSearch}%`)
        .limit(5);
      
      if (error) {
        console.error('Error fetching master commodities:', error);
        return [];
      }
      return data;
    },
    enabled: debouncedSearch.length > 1,
  });

  // Query HTS Codes (Global Dictionary)
  const { data: htsCodes, isLoading: loadingHTS } = useQuery({
    queryKey: ['hts_codes', debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch) return [];
      
      // Use the Smart Search RPC (Fuzzy Matching)
      const { data, error } = await supabase.rpc('search_hts_codes_smart', {
        p_search_term: debouncedSearch,
        p_limit: 10
      });
      
      if (error) {
        console.warn('Smart search failed, falling back to simple search:', error);
        
        // Fallback to simple ILIKE search
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('aes_hts_codes')
          .select('id, hts_code, description, category')
          .or(`hts_code.ilike.%${debouncedSearch}%,description.ilike.%${debouncedSearch}%`)
          .limit(10);
          
        if (fallbackError) {
          console.error('Fallback search failed:', fallbackError);
          return [];
        }
        return fallbackData;
      }
      
      return data;
    },
    enabled: debouncedSearch.length > 1,
  });

  const handleSelectMaster = (item: any) => {
    onSelect({
      description: item.name,
      aes_hts_id: item.aes_hts_id,
      hts_code: item.aes_hts_codes?.hts_code,
      cargo_type_id: item.default_cargo_type_id,
      unit_value: item.unit_value,
      hazmat_class: item.hazmat_class,
      master_commodity_id: item.id,
    });
    setSearchTerm(item.name);
    setOpen(false);
  };

  const handleSelectHTS = (item: any) => {
    onSelect({
      description: item.description,
      aes_hts_id: item.id,
      hts_code: item.hts_code,
    });
    setSearchTerm(`${item.description} - ${item.hts_code}`);
    setOpen(false);
  };

  const handleBrowserSelect = (selection: { code: string; description: string; id: string }) => {
    onSelect({
      description: selection.description,
      aes_hts_id: selection.id,
      hts_code: selection.code,
    });
    setBrowserOpen(false);
    setSearchTerm(`${selection.description} - ${selection.code}`);
  };

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  return (
    <div className={cn("flex gap-2 w-full", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("flex-1 justify-between text-left font-normal", !searchTerm && "text-muted-foreground")}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              const isPrintable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
              if (isPrintable) {
                setOpen(true);
                setSearchTerm((prev) => prev + e.key);
                e.preventDefault();
              } else if (e.key === 'Backspace') {
                setOpen(true);
                setSearchTerm((prev) => prev.slice(0, Math.max(0, prev.length - 1)));
                e.preventDefault();
              } else if (e.key === 'Escape') {
                setOpen(false);
              }
            }}
            onPaste={(e) => {
              const text = e.clipboardData.getData('text');
              if (text) {
                setOpen(true);
                setSearchTerm(text);
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
              onValueChange={setSearchTerm}
              ref={inputRef as any}
            />
            <CommandList>
              <CommandEmpty className="py-2 px-4 text-sm">
                {debouncedSearch.length < 2 ? (
                  "Type at least 2 characters..."
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="text-muted-foreground">No results found.</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full justify-start"
                      onClick={() => {
                        onSelect({ description: searchTerm });
                        setOpen(false);
                      }}
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Use "{searchTerm}"
                    </Button>
                  </div>
                )}
              </CommandEmpty>
              
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
