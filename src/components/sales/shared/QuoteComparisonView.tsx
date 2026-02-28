import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, X, Info, ChevronDown, ChevronUp, Eye, Sparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { bifurcateCharges } from '@/lib/charge-bifurcation';
import { Charge, TransportLeg, RateOption } from '@/types/quote-breakdown';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  getTierBadge,
  getModeIcon,
  getReliabilityColor
} from '../shared/quote-badges';
import { cn, formatCurrency } from '@/lib/utils';

import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QuoteDetailView } from './QuoteDetailView';
import { mapOptionToQuote } from '@/lib/quote-mapper';
import { useCRM } from '@/hooks/useCRM';
import { PricingService } from '@/services/pricing.service';

interface QuoteComparisonViewProps {
    options: RateOption[];
    onSelect: (option: RateOption) => void;
    selectedIds?: string[];
    onToggleSelection?: (id: string) => void;
    onGenerateSmartOptions?: () => void;
}

export function QuoteComparisonView({ 
    options: rawOptions, 
    onSelect, 
    selectedIds = [], 
    onToggleSelection,
    onGenerateSmartOptions 
}: QuoteComparisonViewProps) {
    const { t } = useTranslation();
    const manualQuoteLabel = t('quotation.manualQuote', { defaultValue: 'Manual Quotation' });
    const { scopedDb, supabase } = useCRM();
    const [showBreakdown, setShowBreakdown] = React.useState(false);
    const [viewDetailsOption, setViewDetailsOption] = React.useState<RateOption | null>(null);
    const [options, setOptions] = useState<RateOption[]>([]);
    const viewDetailsOptionForRender = viewDetailsOption
      ? { ...viewDetailsOption, carrier: getCarrierLabel(viewDetailsOption, manualQuoteLabel) }
      : null;

    // Normalize options and ensure financials
    useEffect(() => {
        const enrichOptions = async () => {
            if (!rawOptions || rawOptions.length === 0) {
                setOptions([]);
                return;
            }

            const pricingService = new PricingService(scopedDb || supabase);
            
            const enriched = await Promise.all(rawOptions.map(async (opt) => {
                const mapped = mapOptionToQuote(opt);
                if (!mapped) return null;

                // Ensure financials exist (synchronize with New Quote logic)
                if (mapped.total_amount && (mapped.markupPercent === undefined || mapped.marginAmount === undefined)) {
                    try {
                        const calc = await pricingService.calculateFinancials(mapped.total_amount, 15, false);
                        
                        let markupPercent = 0;
                        if (calc.buyPrice > 0) {
                            markupPercent = Number(((calc.marginAmount / calc.buyPrice) * 100).toFixed(2));
                        }

                        return {
                            ...mapped,
                            buyPrice: mapped.buyPrice || calc.buyPrice,
                            marginAmount: mapped.marginAmount || calc.marginAmount,
                            markupPercent: mapped.markupPercent || markupPercent,
                            marginPercent: mapped.marginPercent || calc.marginPercent
                        };
                    } catch (e) {
                        console.warn('Pricing enrichment failed', e);
                        return mapped;
                    }
                }
                return mapped;
            }));
            
            setOptions(enriched.filter(Boolean) as RateOption[]);
        };
        
        enrichOptions();
    }, [rawOptions, scopedDb, supabase]);

    if (!options || options.length === 0) return <div className="p-4 text-center text-muted-foreground">No options to compare.</div>;

    // Helper to calculate bifurcated totals for an option
    const getBifurcatedTotals = (opt: RateOption) => {
        const totals = {
            origin: 0,
            freight: 0,
            destination: 0,
            other: 0,
            currency: opt.currency
        };

        const allCharges: Charge[] = [];
        
        // Collect leg charges
        if (opt.legs) {
            opt.legs.forEach(leg => {
                const legType = leg.leg_type || 'transport';
                if (leg.charges) {
                    leg.charges.forEach(c => {
                        allCharges.push({ ...c, leg_id: leg.id, mode: leg.mode });
                    });
                }
            });
        }
        
        // Collect global charges
        if (opt.charges) {
            opt.charges.forEach(c => {
                allCharges.push({ ...c });
            });
        } else if (opt.price_breakdown) {
            // Legacy/alternate structure
            // ...
        }

        // Bifurcate
        const buckets = bifurcateCharges(allCharges, opt.legs || []);
        
        totals.origin = buckets.origin.reduce((sum, c) => sum + (c.amount || 0), 0);
        totals.freight = buckets.freight.reduce((sum, c) => sum + (c.amount || 0), 0);
        totals.destination = buckets.destination.reduce((sum, c) => sum + (c.amount || 0), 0);
        totals.other = buckets.other.reduce((sum, c) => sum + (c.amount || 0), 0);

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
            {onGenerateSmartOptions && (
                <div className="p-4 border-b flex justify-end">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 text-xs gap-1 border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800"
                        onClick={onGenerateSmartOptions}
                    >
                        <Sparkles className="h-3 w-3" />
                        Generate Smart Options
                    </Button>
                </div>
            )}
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
                                            {getTierBadge(opt.tier)}
                                            
                                            <span className="font-bold text-lg text-foreground leading-tight">{getCarrierLabel(opt, manualQuoteLabel)}</span>
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
                            <TableCell key={opt.id} className="text-center">
                                <div className="flex flex-col items-center">
                                    <span className="font-bold text-xl text-foreground">
                                        {formatCurrency(opt.price, opt.currency)}
                                    </span>
                                    {(opt.markupPercent !== undefined || opt.marginAmount !== undefined) && (
                                        <div className="flex flex-col items-center gap-0.5 mt-1">
                                            {opt.markupPercent !== undefined && (
                                                <Badge variant="outline" className="text-[10px] px-1 h-4 border-green-200 text-green-700 bg-green-50">
                                                    {opt.markupPercent}% Mkp
                                                </Badge>
                                            )}
                                            {opt.marginAmount !== undefined && (
                                                <span className="text-[10px] text-green-600 font-medium">
                                                    +{formatCurrency(opt.marginAmount, opt.currency)}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
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
                                            <Badge variant="outline" className={cn("h-5 px-1", getReliabilityColor(opt.reliability.score))}>
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
                            <span>{viewDetailsOptionForRender?.carrier} - {viewDetailsOptionForRender?.name}</span>
                            {viewDetailsOption?.tier && (
                                <Badge variant="secondary" className="capitalize">
                                    {viewDetailsOption.tier.replace('_', ' ')}
                                </Badge>
                            )}
                        </DialogTitle>
                    </DialogHeader>
                    {viewDetailsOptionForRender && (
                        <div className="py-4">
                            <QuoteDetailView 
                                quote={mapOptionToQuote(viewDetailsOptionForRender)} 
                                defaultAnalysisView={viewDetailsOptionForRender.source_attribution === 'AI Smart Engine' ? 'mode' : 'category'}
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function getCarrierLabel(option: RateOption, manualQuoteLabel: string) {
  if (!option) return manualQuoteLabel;
  const carrier = option.carrier || '';
  const source = option.source_attribution || '';
  const isManual = !!option.is_manual || source === 'Manual Entry' || source === 'Manual Quote' || carrier === 'Manual Entry' || carrier.startsWith('Manual Quote');
  if (!isManual) return carrier;
  const match = carrier.match(/(\d+)\s*$/);
  return match ? `${manualQuoteLabel} ${match[1]}` : manualQuoteLabel;
}
