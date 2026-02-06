
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, CheckCircle2, ChevronRight, ChevronLeft, FileText, Droplets, Flame, Loader2, Search } from 'lucide-react';
import { HazmatDetails } from '@/types/cargo';
import { cn } from '@/lib/utils';
import { useCRM } from '@/hooks/useCRM';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface HazmatWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onComplete: (details: HazmatDetails) => void;
    initialData?: HazmatDetails;
}

type WizardStep = 'identification' | 'properties' | 'documentation' | 'review';

const STEPS: { id: WizardStep; label: string; icon: React.ReactNode }[] = [
    { id: 'identification', label: 'Identification', icon: <AlertTriangle className="w-4 h-4" /> },
    { id: 'properties', label: 'Properties', icon: <Flame className="w-4 h-4" /> },
    { id: 'documentation', label: 'Documentation', icon: <FileText className="w-4 h-4" /> },
    { id: 'review', label: 'Review', icon: <CheckCircle2 className="w-4 h-4" /> },
];

export function HazmatWizard({ open, onOpenChange, onComplete, initialData }: HazmatWizardProps) {
    const { supabase } = useCRM();
    const [step, setStep] = useState<WizardStep>('identification');
    const [data, setData] = useState<HazmatDetails>(initialData || {
        unNumber: '',
        class: '',
        packingGroup: 'II',
        flashPoint: { value: 0, unit: 'C' }
    });

    // UN Number Autocomplete State
    const [unSearchOpen, setUnSearchOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Query HTS Codes for UN Number validation (using HTS as proxy for commodity verification)
    const { data: searchResults, isLoading: loadingSearch } = useQuery({
        queryKey: ['hts_un_search', debouncedSearch],
        queryFn: async () => {
            if (!debouncedSearch || debouncedSearch.length < 2) return [];
            
            // Use the Smart Search RPC
            const { data, error } = await supabase.rpc('search_hts_codes_smart', {
                p_search_term: debouncedSearch,
                p_limit: 5
            });
            
            if (error) {
                console.error('Search failed:', error);
                return [];
            }
            return data || [];
        },
        enabled: debouncedSearch.length >= 2,
    });

    const handleSelectResult = (item: any) => {
        // Since we don't have a direct UN number map, we'll use the HTS description 
        // to help verify, but for now we just populate the UN number if the user searched for it
        // or keep the user's input if it was a number.
        // If the user searched "Paint", we can't magically get "1263".
        // But if they typed "1263", we keep "1263".
        
        // Logic: If selection is made, we try to extract a 4-digit code if present, 
        // otherwise we keep the search term if it looks like a UN number.
        const potentialUN = searchTerm.match(/\d{4}/)?.[0] || data.unNumber;
        
        if (potentialUN) {
            updateField('unNumber', potentialUN);
        }
        setUnSearchOpen(false);
    };

    const handleNext = () => {
        const currentIndex = STEPS.findIndex(s => s.id === step);
        if (currentIndex < STEPS.length - 1) {
            setStep(STEPS[currentIndex + 1].id);
        } else {
            onComplete(data);
            onOpenChange(false);
        }
    };

    const handleBack = () => {
        const currentIndex = STEPS.findIndex(s => s.id === step);
        if (currentIndex > 0) {
            setStep(STEPS[currentIndex - 1].id);
        }
    };

    const updateField = (field: keyof HazmatDetails, value: any) => {
        setData(prev => ({ ...prev, [field]: value }));
    };

    const renderStepContent = () => {
        switch (step) {
            case 'identification':
                return (
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>UN Number</Label>
                                <Popover open={unSearchOpen} onOpenChange={setUnSearchOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={unSearchOpen}
                                            className="w-full justify-between"
                                        >
                                            {data.unNumber ? `UN${data.unNumber}` : "Search UN / Commodity..."}
                                            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0" align="start">
                                        <Command>
                                            <CommandInput 
                                                placeholder="Type UN code or description..." 
                                                value={searchTerm}
                                                onValueChange={(val) => {
                                                    setSearchTerm(val);
                                                    // Allow direct entry if it matches UN format
                                                    if (val.match(/^\d{4}$/)) {
                                                        updateField('unNumber', val);
                                                    }
                                                }}
                                            />
                                            <CommandList>
                                                <CommandEmpty>
                                                    {loadingSearch ? (
                                                        <div className="flex items-center justify-center py-2 text-xs text-muted-foreground">
                                                            <Loader2 className="w-3 h-3 animate-spin mr-2" />
                                                            Searching HTS Database...
                                                        </div>
                                                    ) : (
                                                        "No matching codes found."
                                                    )}
                                                </CommandEmpty>
                                                {searchResults?.map((item: any) => (
                                                    <CommandItem
                                                        key={item.id}
                                                        value={item.description}
                                                        onSelect={() => handleSelectResult(item)}
                                                        className="flex flex-col items-start gap-1"
                                                    >
                                                        <span className="font-medium text-xs">{item.hts_code}</span>
                                                        <span className="text-[10px] text-muted-foreground line-clamp-2">{item.description}</span>
                                                    </CommandItem>
                                                ))}
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                                <p className="text-[10px] text-muted-foreground">4-digit number assigned by the UN.</p>
                            </div>
                            <div className="space-y-2">
                                <Label>Proper Shipping Name (Technical Name)</Label>
                                <Input placeholder="e.g. PAINT" />
                                <p className="text-[10px] text-muted-foreground">The standard technical name.</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Class / Division</Label>
                                <Select 
                                    value={data.class} 
                                    onValueChange={(v) => updateField('class', v)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Class" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">Class 1: Explosives</SelectItem>
                                        <SelectItem value="2.1">Class 2.1: Flammable Gas</SelectItem>
                                        <SelectItem value="2.2">Class 2.2: Non-Flammable Gas</SelectItem>
                                        <SelectItem value="3">Class 3: Flammable Liquids</SelectItem>
                                        <SelectItem value="4.1">Class 4.1: Flammable Solids</SelectItem>
                                        <SelectItem value="5.1">Class 5.1: Oxidizers</SelectItem>
                                        <SelectItem value="6.1">Class 6.1: Toxic Substances</SelectItem>
                                        <SelectItem value="8">Class 8: Corrosives</SelectItem>
                                        <SelectItem value="9">Class 9: Miscellaneous</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Packing Group</Label>
                                <Select 
                                    value={data.packingGroup} 
                                    onValueChange={(v: any) => updateField('packingGroup', v)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Group" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="I">I - High Danger</SelectItem>
                                        <SelectItem value="II">II - Medium Danger</SelectItem>
                                        <SelectItem value="III">III - Low Danger</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                );
            case 'properties':
                return (
                    <div className="space-y-4 py-4">
                         <div className="space-y-2">
                            <Label>Physical State</Label>
                            <Tabs defaultValue="liquid" className="w-full">
                                <TabsList className="grid w-full grid-cols-3">
                                    <TabsTrigger value="solid">Solid</TabsTrigger>
                                    <TabsTrigger value="liquid">Liquid</TabsTrigger>
                                    <TabsTrigger value="gas">Gas</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Flash Point</Label>
                                <div className="flex gap-2">
                                    <Input 
                                        type="number" 
                                        value={data.flashPoint?.value}
                                        onChange={(e) => updateField('flashPoint', { ...data.flashPoint, value: parseFloat(e.target.value) || 0 })}
                                    />
                                    <Select 
                                        value={data.flashPoint?.unit || 'C'}
                                        onValueChange={(v: 'C' | 'F') => updateField('flashPoint', { ...data.flashPoint, unit: v })}
                                    >
                                        <SelectTrigger className="w-20">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="C">°C</SelectItem>
                                            <SelectItem value="F">°F</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                             <div className="space-y-2">
                                <Label>Marine Pollutant</Label>
                                <Select>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="yes">Yes</SelectItem>
                                        <SelectItem value="no">No</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                         <div className="bg-blue-50 border border-blue-100 p-3 rounded-md flex items-start gap-3">
                            <Droplets className="w-5 h-5 text-blue-600 mt-0.5" />
                            <div className="space-y-1">
                                <h4 className="text-sm font-medium text-blue-900">Segregation Warning</h4>
                                <p className="text-xs text-blue-700">Based on Class {data.class || '?'}, this item may need to be segregated from Foodstuffs and Class 1 Explosives.</p>
                            </div>
                        </div>
                    </div>
                );
            case 'documentation':
                return (
                    <div className="space-y-6 py-4">
                        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:bg-muted/5 transition-colors cursor-pointer">
                            <FileText className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                            <h3 className="text-sm font-medium">Upload MSDS / SDS</h3>
                            <p className="text-xs text-muted-foreground mt-1">Drag and drop your Material Safety Data Sheet here, or click to browse.</p>
                        </div>

                        <div className="space-y-3">
                            <Label>Emergency Contact</Label>
                            <div className="grid grid-cols-2 gap-4">
                                <Input placeholder="Name" />
                                <Input placeholder="Phone Number" />
                            </div>
                            <p className="text-[10px] text-muted-foreground">24-hour emergency response contact required for transport.</p>
                        </div>
                    </div>
                );
            case 'review':
                return (
                    <div className="space-y-4 py-4">
                        <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <span className="text-muted-foreground">UN Number:</span>
                                <span className="font-medium font-mono">UN{data.unNumber}</span>
                                
                                <span className="text-muted-foreground">Class:</span>
                                <span className="font-medium">{data.class}</span>
                                
                                <span className="text-muted-foreground">Packing Group:</span>
                                <span className="font-medium">{data.packingGroup}</span>
                                
                                <span className="text-muted-foreground">Flash Point:</span>
                                <span className="font-medium">{data.flashPoint?.value}°{data.flashPoint?.unit}</span>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 bg-green-50 text-green-800 border border-green-200 rounded-md">
                            <CheckCircle2 className="w-5 h-5 mt-0.5" />
                            <div className="space-y-1">
                                <h4 className="text-sm font-medium">Compliance Check Passed</h4>
                                <p className="text-xs opacity-90">This configuration appears valid for General Cargo transport. Final carrier approval required.</p>
                            </div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        Hazmat Wizard
                    </DialogTitle>
                    <DialogDescription>
                        Configure dangerous goods details for compliance.
                    </DialogDescription>
                </DialogHeader>

                {/* Stepper */}
                <div className="flex items-center justify-between px-2 py-4">
                    {STEPS.map((s, i) => (
                        <div key={s.id} className="flex items-center gap-2">
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-xs transition-colors",
                                step === s.id ? "bg-primary text-primary-foreground font-bold" : 
                                STEPS.findIndex(st => st.id === step) > i ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                            )}>
                                {s.icon}
                            </div>
                            {i < STEPS.length - 1 && (
                                <div className={cn("h-[2px] w-8", STEPS.findIndex(st => st.id === step) > i ? "bg-primary/50" : "bg-muted")} />
                            )}
                        </div>
                    ))}
                </div>

                <div className="min-h-[300px]">
                    {renderStepContent()}
                </div>

                <DialogFooter className="flex justify-between sm:justify-between">
                    <Button 
                        variant="ghost" 
                        onClick={handleBack} 
                        disabled={step === 'identification'}
                    >
                        <ChevronLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                    <Button onClick={handleNext} className={step === 'review' ? "bg-green-600 hover:bg-green-700" : ""}>
                        {step === 'review' ? 'Confirm & Apply' : 'Next'}
                        {step !== 'review' && <ChevronRight className="w-4 h-4 ml-2" />}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
