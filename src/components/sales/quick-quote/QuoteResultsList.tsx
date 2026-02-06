import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { 
    Tooltip, 
    TooltipContent, 
    TooltipProvider, 
    TooltipTrigger 
} from "@/components/ui/tooltip";
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from '@/components/ui/table';
import { QuoteLegsVisualizer } from './QuoteLegsVisualizer';
import { QuoteMapVisualizer } from './QuoteMapVisualizer';
import { QuoteDetailView } from './QuoteDetailView';
import { mapOptionToQuote } from '@/lib/quote-mapper';
import { 
    Sparkles, 
    Leaf, 
    ChevronDown, 
    ChevronUp, 
    ShieldCheck,
    LayoutList,
    MapIcon,
    LayoutGrid,
    ListIcon,
    Columns,
    Ship,
    Plane,
    Truck,
    Train,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatContainerSize } from '@/lib/container-utils';

import {
    getTierBadge,
    getModeIcon,
    getReliabilityColor
} from '../shared/quote-badges';
import { formatCurrency } from '@/lib/utils';
import { RateOption, TransportLeg } from '@/types/quote-breakdown';

interface QuoteResultsListProps {
    results: RateOption[];
    onSelect: (option: RateOption) => void;
    selectedIds?: string[];
    onToggleSelection?: (id: string) => void;
    onGenerateSmartOptions?: () => void;
    marketAnalysis?: string | null;
    confidenceScore?: number | null;
    anomalies?: any[];
}

const mapLegsForVisualizer = (legs: TransportLeg[] | undefined) => {
    if (!legs) return [];
    return legs.map(leg => ({
        from: leg.origin,
        to: leg.destination,
        mode: leg.mode,
        carrier: leg.carrier,
        transit_time: leg.transit_time,
        origin: leg.origin,
        destination: leg.destination
    }));
};

export function QuoteResultsList({  
    results, 
    onSelect, 
    selectedIds = [], 
    onToggleSelection,
    onGenerateSmartOptions,
    marketAnalysis,
    confidenceScore,
    anomalies
}: QuoteResultsListProps) {
    const [viewMode, setViewMode] = useState<'card' | 'list' | 'table'>('card');
    const [viewDetailsId, setViewDetailsId] = useState<string | null>(null);
    const [filterType, setFilterType] = useState<'all' | 'market' | 'ai'>('all');

    const viewDetailsOption = results.find(r => r.id === viewDetailsId);

    if (!results || results.length === 0) return null;

    // Filter results
    const filteredResults = results.filter(r => {
        if (filterType === 'all') return true;
        if (filterType === 'market') return r.source_attribution === 'Standard Rate Engine';
        if (filterType === 'ai') return r.source_attribution === 'AI Smart Engine';
        return true;
    });



    const renderCardView = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
            {filteredResults.map((option) => {
                const isSelected = selectedIds.includes(option.id);
                return (
                    <Card 
                        key={option.id} 
                        className={cn(
                            "cursor-pointer transition-all duration-200 hover:shadow-lg border",
                            isSelected ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-primary/50",
                            viewDetailsId === option.id ? "ring-2 ring-primary/20" : ""
                        )}
                        onClick={() => onToggleSelection ? onToggleSelection(option.id) : onSelect(option)}
                    >
                        <CardHeader className="pb-3 pt-4 px-4">
                            <div className="flex justify-between items-start gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                        {onToggleSelection && (
                                            <Checkbox 
                                                checked={isSelected}
                                                onCheckedChange={() => onToggleSelection(option.id)}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        )}
                                        <h4 className="font-bold text-lg leading-tight truncate">{option.carrier}</h4>
                                        {getTierBadge(option.tier)}
                                        {option.source_attribution?.includes("AI") ? (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px] px-1.5 h-5 whitespace-nowrap border-0 flex items-center gap-1 cursor-help">
                                                            <Sparkles className="w-3 h-3" /> AI Generated
                                                        </Badge>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Generated by AI Advisor based on historical data.</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        ) : (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-[10px] px-1.5 h-5 whitespace-nowrap border-0 flex items-center gap-1 cursor-help">
                                                            <ShieldCheck className="w-3 h-3" /> Market Rate
                                                        </Badge>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Real-time market rate verified via Carrier API.</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}

                                    </div>
                                    <p className="text-sm text-muted-foreground truncate font-medium" title={option.name}>{formatContainerSize(option.name)}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-xl font-bold text-primary whitespace-nowrap tracking-tight">
                                        {formatCurrency(option.price, option.currency)}
                                    </div>
                                    <div className="text-[10px] uppercase text-muted-foreground font-semibold">Total Estimate</div>
                                    
                                    {option.verified && (
                                        <div className="flex items-center gap-1 text-[9px] text-green-600 justify-end mb-1">
                                            <ShieldCheck className="w-2.5 h-2.5" />
                                            <span>Verified {option.verificationTimestamp ? new Date(option.verificationTimestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
                                        </div>
                                    )}

                                    {/* Financials (if available) */}
                                    {(option.markupPercent !== undefined || option.marginAmount !== undefined) && (
                                        <div className="mt-1 flex flex-col items-end gap-0.5">
                                            {option.markupPercent !== undefined && (
                                                <Badge variant="outline" className="text-[10px] px-1 h-4 border-green-200 text-green-700 bg-green-50 whitespace-nowrap">
                                                    {option.markupPercent}% Mkp
                                                </Badge>
                                            )}
                                            {option.marginAmount !== undefined && (
                                                <span className="text-[10px] text-green-600 font-medium whitespace-nowrap">
                                                    +{formatCurrency(option.marginAmount, option.currency)}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4 px-4 pb-4 pt-0">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="space-y-1">
                                    <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Service</span>
                                    <div className="font-medium flex items-center gap-1.5 truncate">
                                        {getModeIcon(option.transport_mode || 'ocean')}
                                        <span className="truncate">{option.route_type || 'Standard'}</span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Transit Time</span>
                                    <div className="font-medium truncate">{option.transitTime}</div>
                                </div>
                            </div>

                            <div className="pt-3 border-t grid grid-cols-2 gap-2">
                                {option.reliability && (
                                    <div className={cn("px-2 py-1 rounded text-xs font-medium border flex items-center justify-between", getReliabilityColor(option.reliability.score))}>
                                        <span>Reliability</span>
                                        <span>{option.reliability.score}/10</span>
                                    </div>
                                )}
                                {(option.co2_kg || option.environmental) && (
                                    <div className="px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200 flex items-center justify-between">
                                        <span className="flex items-center gap-1"><Leaf className="h-3 w-3" /> CO2</span>
                                        <span>{option.co2_kg ? `${option.co2_kg} kg` : option.environmental?.co2_emissions}</span>
                                    </div>
                                )}
                            </div>
                            
                            {option.ai_explanation && (
                                <div className="text-xs text-purple-700 bg-purple-50 p-2 rounded border border-purple-100 flex items-start gap-2">
                                    <Sparkles className="w-3 h-3 mt-0.5 shrink-0" />
                                    <span>{option.ai_explanation}</span>
                                </div>
                            )}

                            {option.legs && option.legs.length > 0 && (
                                <QuoteLegsVisualizer legs={mapLegsForVisualizer(option.legs)} />
                            )}

                            <div className="pt-2 flex justify-end gap-2">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="gap-1 text-xs h-7"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setViewDetailsId(option.id);
                                    }}
                                >
                                    <ListIcon className="w-3 h-3" />
                                    Details
                                </Button>
                                <Button 
                                    variant="default" 
                                    size="sm" 
                                    className="gap-1 text-xs h-7"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSelect(option);
                                    }}
                                >
                                    Select
                                </Button>
                            </div>


                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );

    const renderListView = () => (
        <div className="space-y-2">
            {results.map((option) => {
                const isSelected = selectedIds.includes(option.id);
                return (
                    <div 
                        key={option.id}
                        className={cn(
                            "group rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer",
                            isSelected ? "border-primary bg-primary/5" : "border-border",
                            viewDetailsId === option.id ? "ring-2 ring-primary/20" : ""
                        )}
                        onClick={() => setViewDetailsId(option.id)}
                    >
                        <div className="flex items-center justify-between p-3">
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                {onToggleSelection && (
                                    <Checkbox 
                                        checked={isSelected}
                                        onCheckedChange={() => onToggleSelection(option.id)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="shrink-0"
                                    />
                                )}
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="p-2 bg-muted rounded-md shrink-0">
                                        {getModeIcon(option.transport_mode || 'ocean')}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold truncate">{option.carrier}</span>
                                            {getTierBadge(option.tier)}
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                                            <span className="truncate">{option.transitTime}</span>
                                            <span>•</span>
                                            <span className="truncate">{option.route_type || 'Standard'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-6 shrink-0 ml-4">
                                <div className="text-right">
                                    <div className="font-bold text-lg text-primary whitespace-nowrap">
                                        {formatCurrency(option.price, option.currency)}
                                    </div>
                                    {(option.markupPercent !== undefined || option.marginAmount !== undefined) && (
                                        <div className="flex items-center justify-end gap-2 text-xs mb-1">
                                            {option.marginAmount !== undefined && (
                                                <span className="text-green-600 font-medium whitespace-nowrap">+{formatCurrency(option.marginAmount, option.currency)}</span>
                                            )}
                                            {option.markupPercent !== undefined && (
                                                <Badge variant="outline" className="text-[10px] px-1 h-4 border-green-200 text-green-700 bg-green-50 shrink-0">
                                                    {option.markupPercent}%
                                                </Badge>
                                            )}
                                        </div>
                                    )}
                                    {(option.co2_kg || option.environmental) && (
                                        <div className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                                            <Leaf className="w-3 h-3" />
                                            <span className="whitespace-nowrap">{option.co2_kg ? `${option.co2_kg} kg` : option.environmental?.co2_emissions}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Button 
                                        variant="ghost" 
                                        size="sm"
                                        className="shrink-0"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setViewDetailsId(option.id);
                                        }}
                                    >
                                        <ListIcon className="w-4 h-4" />
                                    </Button>
                                    <Button 
                                        size="sm"
                                        className="shrink-0"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSelect(option);
                                        }}
                                    >
                                        Select
                                    </Button>
                                </div>
                            </div>
                        </div>
                        

                    </div>
                );
            })}
        </div>
    );

    const renderTableView = () => (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[50px]">Select</TableHead>
                        <TableHead>Carrier</TableHead>
                        <TableHead>Option Name</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Transit Time</TableHead>
                        <TableHead>Reliability</TableHead>
                        <TableHead>CO2</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Markup</TableHead>
                        <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {results.map((option) => {
                        const isSelected = selectedIds.includes(option.id);
                        return (
                            <React.Fragment key={option.id}>
                                <TableRow 
                                    className={cn("cursor-pointer", isSelected ? "bg-muted/50" : "")}
                                    onClick={() => {
                                        if (option.id) setViewDetailsId(option.id);
                                    }}
                                >
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        {onToggleSelection && (
                                            <Checkbox 
                                                checked={isSelected}
                                                onCheckedChange={() => onToggleSelection(option.id)}
                                            />
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{option.carrier}</span>
                                            {option.source_attribution?.includes("AI") && (
                                                <Sparkles className="h-3 w-3 text-purple-500" />
                                            )}
                                            {getTierBadge(option.tier)}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm text-muted-foreground">{option.name}</span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            {getModeIcon(option.transport_mode || 'ocean')}
                                            <span className="text-sm">{option.route_type || 'Standard'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>{option.transitTime}</TableCell>
                                    <TableCell>
                                        {option.reliability ? (
                                            <Badge variant="outline" className={cn("font-normal", getReliabilityColor(option.reliability.score).split(' ')[1])}>
                                                {option.reliability.score}/10
                                            </Badge>
                                        ) : '-'}
                                    </TableCell>
                                    <TableCell>
                                        {(option.co2_kg || option.environmental) ? (
                                            <span>{option.co2_kg ? `${option.co2_kg} kg` : option.environmental?.co2_emissions}</span>
                                        ) : '-'}
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-primary">
                                        {formatCurrency(option.price, option.currency)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {option.markupPercent !== undefined ? (
                                            <div className="flex flex-col items-end gap-0.5">
                                                <Badge variant="outline" className="text-[10px] px-1 h-4 border-green-200 text-green-700 bg-green-50">
                                                    {option.markupPercent}%
                                                </Badge>
                                                {option.marginAmount !== undefined && (
                                                    <span className="text-[10px] text-green-600">
                                                        +{formatCurrency(option.marginAmount, option.currency)}
                                                    </span>
                                                )}
                                            </div>
                                        ) : '-'}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-1">
                                            <Button 
                                                variant="ghost" 
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setViewDetailsId(option.id);
                                                }}
                                            >
                                                <ListIcon className="w-4 h-4" />
                                            </Button>
                                            <Button 
                                                size="sm"
                                                variant="outline"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSelect(option);
                                                }}
                                            >
                                                Select
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>

                            </React.Fragment>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* AI Analysis Section - Synchronized with New Quote Module */}
            {marketAnalysis && (
                <Card className="bg-gradient-to-r from-indigo-50/50 to-purple-50/50 border-indigo-100 shadow-sm">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-indigo-600" />
                                <CardTitle className="text-lg font-semibold text-indigo-900">AI Market Analysis</CardTitle>
                            </div>
                            {confidenceScore && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-muted-foreground">Confidence Score:</span>
                                    <div className="h-2 w-24 bg-gray-200 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-indigo-500 rounded-full transition-all duration-500" 
                                            style={{ width: `${confidenceScore}%` }}
                                        />
                                    </div>
                                    <span className="text-xs font-bold text-indigo-700">{confidenceScore}%</span>
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-indigo-800/90 leading-relaxed">
                            {marketAnalysis}
                        </p>
                        {anomalies && anomalies.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {anomalies.map((anomaly: any, i: number) => (
                                    <Badge key={i} variant="outline" className="border-yellow-200 bg-yellow-50 text-yellow-800 text-xs">
                                        Alert: {typeof anomaly === 'string' ? anomaly : anomaly.description || 'Route anomaly detected'}
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold tracking-tight">Rate Options ({results.length})</h3>
                <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
                    <Button 
                        variant={viewMode === 'card' ? 'secondary' : 'ghost'} 
                        size="sm" 
                        className="h-7 px-2"
                        onClick={() => setViewMode('card')}
                    >
                        <LayoutGrid className="h-4 w-4 mr-1" /> Cards
                    </Button>
                    <Button 
                        variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                        size="sm" 
                        className="h-7 px-2"
                        onClick={() => setViewMode('list')}
                    >
                        <ListIcon className="h-4 w-4 mr-1" /> List
                    </Button>
                    <Button 
                        variant={viewMode === 'table' ? 'secondary' : 'ghost'} 
                        size="sm" 
                        className="h-7 px-2"
                        onClick={() => setViewMode('table')}
                    >
                        <Columns className="h-4 w-4 mr-1" /> Grid
                    </Button>
                </div>
            </div>

            {viewMode === 'card' && renderCardView()}
            {viewMode === 'list' && renderListView()}
            {viewMode === 'table' && renderTableView()}

            {/* Modal for Detailed View */}
            <Dialog open={!!viewDetailsId} onOpenChange={(open) => !open && setViewDetailsId(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <span>{viewDetailsOption?.carrier} - {viewDetailsOption?.name}</span>
                            {viewDetailsOption?.tier && (
                                <span className="transform scale-90 origin-left">
                                    {getTierBadge(viewDetailsOption.tier)}
                                </span>
                            )}
                        </DialogTitle>
                    </DialogHeader>
                    {viewDetailsOption && (
                        <div className="py-4">
                            <QuoteDetailView 
                                quote={mapOptionToQuote(viewDetailsOption)} 
                                defaultAnalysisView={viewDetailsOption.source_attribution === 'AI Smart Engine' ? 'mode' : 'category'}
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
