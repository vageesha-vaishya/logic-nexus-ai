import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, X, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
}

import { Checkbox } from "@/components/ui/checkbox";

interface QuoteComparisonViewProps {
    options: RateOption[];
    onSelect: (option: RateOption) => void;
    selectedIds?: string[];
    onToggleSelection?: (id: string) => void;
}

export function QuoteComparisonView({ options, onSelect, selectedIds = [], onToggleSelection }: QuoteComparisonViewProps) {
    if (!options || options.length === 0) return <div className="p-4 text-center text-muted-foreground">No options to compare.</div>;

    return (
        <div className="overflow-x-auto border rounded-md">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[150px]">Feature</TableHead>
                        {options.map(opt => {
                            const isSelected = selectedIds.includes(opt.id);
                            return (
                                <TableHead key={opt.id} className={`min-w-[180px] text-center ${isSelected ? 'bg-primary/5' : 'bg-muted/20'}`}>
                                    <div className="flex flex-col items-center gap-1 py-2 relative">
                                        {onToggleSelection && (
                                            <div className="absolute top-1 right-1">
                                                <Checkbox 
                                                    checked={isSelected}
                                                    onCheckedChange={() => onToggleSelection(opt.id)}
                                                />
                                            </div>
                                        )}
                                        <span className="font-bold text-foreground mt-2">{opt.carrier}</span>
                                    <span className="text-xs font-normal text-muted-foreground">{opt.name}</span>
                                    {opt.tier && (
                                        <Badge variant="secondary" className="text-[10px] capitalize">
                                            {opt.tier.replace('_', ' ')}
                                        </Badge>
                                    )}
                                </div>
                            </TableHead>
                            );
                        })}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableRow>
                        <TableCell className="font-medium">Total Cost</TableCell>
                        {options.map(opt => (
                            <TableCell key={opt.id} className="text-center font-bold text-lg text-primary">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: opt.currency }).format(opt.price)}
                            </TableCell>
                        ))}
                    </TableRow>
                    <TableRow>
                        <TableCell className="font-medium">Transit Time</TableCell>
                        {options.map(opt => (
                            <TableCell key={opt.id} className="text-center">
                                {opt.transitTime}
                            </TableCell>
                        ))}
                    </TableRow>
                    <TableRow>
                        <TableCell className="font-medium">Route Details</TableCell>
                        {options.map(opt => (
                            <TableCell key={opt.id} className="text-center">
                                <div className="flex flex-col items-center gap-1">
                                    {opt.route_type && (
                                        <Badge variant="outline" className="text-[10px]">
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
                    <TableRow>
                        <TableCell className="font-medium">Reliability</TableCell>
                        {options.map(opt => (
                            <TableCell key={opt.id} className="text-center">
                                {opt.reliability ? (
                                    <div className="flex flex-col items-center">
                                        <span className="font-semibold">{opt.reliability.score}/10</span>
                                        <span className="text-[10px] text-muted-foreground">{opt.reliability.on_time_performance}</span>
                                    </div>
                                ) : <span className="text-muted-foreground">-</span>}
                            </TableCell>
                        ))}
                    </TableRow>
                    <TableRow>
                        <TableCell className="font-medium">Eco Rating</TableCell>
                        {options.map(opt => (
                            <TableCell key={opt.id} className="text-center">
                                {(opt.environmental || opt.co2_kg) ? (
                                    <div className="flex flex-col items-center">
                                        <span className="font-semibold text-green-600">
                                            {opt.environmental?.rating || (opt.co2_kg ? (opt.co2_kg < 1000 ? 'A' : 'B') : 'N/A')}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">
                                            {opt.co2_kg ? `${opt.co2_kg} kg` : opt.environmental?.co2_emissions}
                                        </span>
                                    </div>
                                ) : <span className="text-muted-foreground">-</span>}
                            </TableCell>
                        ))}
                    </TableRow>
                    <TableRow>
                        <TableCell className="font-medium">AI Analysis</TableCell>
                        {options.map(opt => (
                            <TableCell key={opt.id} className="text-center">
                                {opt.ai_explanation ? (
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger>
                                                <Info className="w-4 h-4 text-purple-500" />
                                            </TooltipTrigger>
                                            <TooltipContent className="max-w-[200px]">
                                                {opt.ai_explanation}
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                ) : <span className="text-muted-foreground text-xs">-</span>}
                            </TableCell>
                        ))}
                    </TableRow>
                    <TableRow>
                        <TableCell></TableCell>
                        {options.map(opt => (
                            <TableCell key={opt.id} className="text-center">
                                <Button size="sm" onClick={() => onSelect(opt)} className="w-full">
                                    Select
                                </Button>
                            </TableCell>
                        ))}
                    </TableRow>
                </TableBody>
            </Table>
        </div>
    );
}
