import React, { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, X, Info, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { bifurcateCharges } from '@/lib/charge-bifurcation';
import { Charge, TransportLeg } from '@/types/quote-breakdown';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface RateOption {
    id: string;
    carrier: string;
    name: string;
    price: number;
    currency: string;
    transitTime: string;
    tier: 'contract' | 'spot' | 'market' | 'best_value' | 'cheapest' | 'fastest' | 'greenest' | 'reliable' | string;
    reliability?: { score: number; on_time_performance: string };
    environmental?: { co2_emissions: string; rating: string };
    ai_explanation?: string;
    source_attribution?: string;
    co2_kg?: number;
    route_type?: 'Direct' | 'Transshipment';
    stops?: number;
    legs?: TransportLeg[];
    charges?: Charge[];
    price_breakdown?: any;
}

import { Checkbox } from "@/components/ui/checkbox";

interface QuoteComparisonViewProps {
    options: RateOption[];
    onSelect: (option: RateOption) => void;
    selectedIds?: string[];
    onToggleSelection?: (id: string) => void;
}

export function QuoteComparisonView({ options, onSelect, selectedIds = [], onToggleSelection }: QuoteComparisonViewProps) {
    const [showBreakdown, setShowBreakdown] = React.useState(false);

    if (!options || options.length === 0) return <div className="p-4 text-center text-muted-foreground">No options to compare.</div>;

    // Helper to calculate bifurcated totals for an option
    const getBifurcatedTotals = (opt: RateOption) => {
        // Use provided charges or fallback to empty
        // If option has legs but no flat charges list, we might need to extract charges from legs
        let allCharges: Charge[] = opt.charges || [];
        
        if (allCharges.length === 0 && opt.legs) {
             opt.legs.forEach(leg => {
                 if (leg.charges) {
                     // Add leg context if missing
                     const legCharges = leg.charges.map(c => ({...c, leg_id: c.leg_id || leg.id}));
                     allCharges = [...allCharges, ...legCharges];
                 }
             });
        }
        
        // Also check price_breakdown if it's a simple object and no charges array exists
        // (This handles some legacy/AI formats)
        
        const legs = opt.legs || [];
        const bifurcated = bifurcateCharges(allCharges, legs);

        const totals = {
            origin: 0,
            freight: 0,
            destination: 0,
            other: 0,
            currency: opt.currency
        };

        bifurcated.forEach(c => {
            if (c.assignedLegType === 'pickup' || c.assignedLegType === 'origin') {
                totals.origin += c.amount;
            } else if (c.assignedLegType === 'transport' || c.assignedLegType === 'main') {
                totals.freight += c.amount;
            } else if (c.assignedLegType === 'delivery' || c.assignedLegType === 'destination') {
                totals.destination += c.amount;
            } else {
                totals.other += c.amount;
            }
        });

        return totals;
    };

    const bifurcatedData = useMemo(() => {
        return options.reduce((acc, opt) => {
            acc[opt.id] = getBifurcatedTotals(opt);
            return acc;
        }, {} as Record<string, ReturnType<typeof getBifurcatedTotals>>);
    }, [options]);

    return (
        <div className="overflow-x-auto border rounded-md bg-background shadow-sm">
            <Table>
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[180px] bg-muted/30">Feature</TableHead>
                        {options.map(opt => {
                            const isSelected = selectedIds.includes(opt.id);
                            // Highlight logic
                            const isBestValue = opt.tier === 'best_value';
                            const isCheapest = opt.tier === 'cheapest';
                            const isFastest = opt.tier === 'fastest';
                            
                            let highlightClass = "";
                            if (isBestValue) highlightClass = "border-b-4 border-b-blue-500 bg-blue-50/50";
                            else if (isCheapest) highlightClass = "border-b-4 border-b-green-500 bg-green-50/50";
                            else if (isFastest) highlightClass = "border-b-4 border-b-purple-500 bg-purple-50/50";
                            else if (isSelected) highlightClass = "bg-primary/5";

                            return (
                                <TableHead key={opt.id} className={`min-w-[220px] text-center align-top pt-4 pb-4 ${highlightClass} transition-colors relative`}>
                                    <div className="flex flex-col items-center gap-2 h-full justify-between">
                                        <div className="flex flex-col items-center w-full relative">
                                            {onToggleSelection && (
                                                <div className="absolute top-0 right-1">
                                                    <Checkbox 
                                                        checked={isSelected}
                                                        onCheckedChange={() => onToggleSelection(opt.id)}
                                                    />
                                                </div>
                                            )}
                                            
                                            {/* Tier Badge */}
                                            {opt.tier && (
                                                <Badge 
                                                    variant={['best_value', 'cheapest', 'fastest'].includes(opt.tier) ? 'default' : 'secondary'} 
                                                    className={`mb-2 capitalize ${isBestValue ? 'bg-blue-600 hover:bg-blue-700' : isCheapest ? 'bg-green-600 hover:bg-green-700' : isFastest ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
                                                >
                                                    {opt.tier.replace('_', ' ')}
                                                </Badge>
                                            )}
                                            
                                            <span className="font-bold text-lg text-foreground leading-tight">{opt.carrier}</span>
                                            <span className="text-xs text-muted-foreground">{opt.name}</span>
                                        </div>
                                    </div>
                                </TableHead>
                            );
                        })}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {/* Price Section */}
                    <TableRow>
                        <TableCell className="font-semibold bg-muted/10">Total Estimated Cost</TableCell>
                        {options.map(opt => (
                            <TableCell key={opt.id} className="text-center font-bold text-xl text-foreground">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: opt.currency }).format(opt.price)}
                            </TableCell>
                        ))}
                    </TableRow>

                    {/* Bifurcated Costs - Simplified */}
                    <TableRow>
                        <TableCell className="font-medium pl-6 text-muted-foreground text-sm">Origin Charges</TableCell>
                        {options.map(opt => (
                            <TableCell key={opt.id} className="text-center text-sm text-muted-foreground">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: opt.currency }).format(bifurcatedData[opt.id].origin)}
                            </TableCell>
                        ))}
                    </TableRow>
                    <TableRow>
                        <TableCell className="font-medium pl-6 text-muted-foreground text-sm">Freight Charges</TableCell>
                        {options.map(opt => (
                            <TableCell key={opt.id} className="text-center text-sm text-muted-foreground">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: opt.currency }).format(bifurcatedData[opt.id].freight)}
                            </TableCell>
                        ))}
                    </TableRow>
                    <TableRow>
                        <TableCell className="font-medium pl-6 text-muted-foreground text-sm">Destination Charges</TableCell>
                        {options.map(opt => (
                            <TableCell key={opt.id} className="text-center text-sm text-muted-foreground">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: opt.currency }).format(bifurcatedData[opt.id].destination)}
                            </TableCell>
                        ))}
                    </TableRow>

                    {/* Transit Time */}
                    <TableRow className="border-t-2">
                        <TableCell className="font-semibold bg-muted/10">Transit Time</TableCell>
                        {options.map(opt => (
                            <TableCell key={opt.id} className="text-center">
                                <div className="flex items-center justify-center gap-1 font-medium">
                                    {opt.transitTime}
                                </div>
                            </TableCell>
                        ))}
                    </TableRow>

                    {/* Reliability & Eco */}
                    <TableRow>
                        <TableCell className="font-semibold bg-muted/10">Reliability & Eco</TableCell>
                        {options.map(opt => (
                            <TableCell key={opt.id} className="text-center">
                                <div className="flex flex-col gap-2 items-center justify-center py-2">
                                    {opt.reliability ? (
                                        <div className="flex items-center gap-1 text-xs" title="Reliability Score">
                                            <Badge variant="outline" className="h-5 px-1 bg-blue-50 text-blue-700 border-blue-200">
                                                ★ {opt.reliability.score}/10
                                            </Badge>
                                        </div>
                                    ) : <span className="text-muted-foreground text-xs">-</span>}
                                    
                                    {(opt.environmental || opt.co2_kg) && (
                                        <div className="flex items-center gap-1 text-xs" title="CO2 Emissions">
                                            <Badge variant="outline" className="h-5 px-1 bg-green-50 text-green-700 border-green-200">
                                                🌱 {opt.co2_kg ? `${Math.round(opt.co2_kg)} kg` : opt.environmental?.co2_emissions}
                                            </Badge>
                                        </div>
                                    )}
                                </div>
                            </TableCell>
                        ))}
                    </TableRow>

                    {/* Route Info */}
                    <TableRow>
                        <TableCell className="font-semibold bg-muted/10">Route</TableCell>
                        {options.map(opt => (
                            <TableCell key={opt.id} className="text-center">
                                <div className="flex flex-col items-center gap-1">
                                    {opt.route_type && (
                                        <Badge variant="secondary" className="text-[10px]">
                                            {opt.route_type}
                                        </Badge>
                                    )}
                                    {opt.stops !== undefined && (
                                        <span className="text-xs text-muted-foreground">
                                            {opt.stops === 0 ? 'Direct' : `${opt.stops} Stop${opt.stops > 1 ? 's' : ''}`}
                                        </span>
                                    )}
                                </div>
                            </TableCell>
                        ))}
                    </TableRow>

                    {/* AI Analysis */}
                    <TableRow>
                        <TableCell className="font-semibold bg-muted/10">AI Insight</TableCell>
                        {options.map(opt => (
                            <TableCell key={opt.id} className="text-center">
                                {opt.ai_explanation ? (
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full text-purple-600 hover:text-purple-700 hover:bg-purple-50">
                                                    <Info className="w-4 h-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent className="max-w-[250px] p-3 text-xs">
                                                {opt.ai_explanation}
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                ) : <span className="text-muted-foreground text-xs">-</span>}
                            </TableCell>
                        ))}
                    </TableRow>

                    {/* Action */}
                    <TableRow className="bg-muted/5">
                        <TableCell></TableCell>
                        {options.map(opt => (
                            <TableCell key={opt.id} className="p-4">
                                <div className="flex flex-col gap-2">
                                    <Button 
                                        size="sm" 
                                        onClick={() => onSelect(opt)} 
                                        className={`w-full ${selectedIds.includes(opt.id) ? 'bg-primary' : 'bg-primary/90'}`}
                                    >
                                        {selectedIds.includes(opt.id) ? (
                                            <><Check className="mr-2 h-4 w-4" /> Selected</>
                                        ) : (
                                            "Select"
                                        )}
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => setViewDetailsOption(opt)}
                                        className="w-full text-xs h-7"
                                    >
                                        <Eye className="w-3 h-3 mr-1" /> View Details
                                    </Button>
                                </div>
                            </TableCell>
                        ))}
                    </TableRow>
                </TableBody>
            </Table>

            {/* Detailed View Dialog */}
            <Dialog open={!!viewDetailsOption} onOpenChange={(open) => !open && setViewDetailsOption(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <span>{viewDetailsOption?.carrier} - {viewDetailsOption?.name}</span>
                            {viewDetailsOption?.tier && (
                                <Badge variant="secondary" className="capitalize">
                                    {viewDetailsOption.tier.replace('_', ' ')}
                                </Badge>
                            )}
                        </DialogTitle>
                    </DialogHeader>
                    {viewDetailsOption && (
                        <div className="py-4">
                            <QuoteDetailView 
                                quote={mapOptionToQuote(viewDetailsOption)} 
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
