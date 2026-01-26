import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from '@/components/ui/table';
import { QuoteLegsVisualizer } from './QuoteLegsVisualizer';
import { QuoteDetailView } from './QuoteDetailView';
import { QuoteMapVisualizer } from './QuoteMapVisualizer';
import { mapOptionToQuote } from '@/lib/quote-mapper';
import { 
    Sparkles, 
    Leaf, 
    ChevronDown, 
    ChevronUp, 
    Map as MapIcon, 
    LayoutList,
    LayoutGrid,
    List as ListIcon,
    Columns
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

import { 
    getTierBadge, 
    getModeIcon, 
    formatCurrency,
    getReliabilityColor
} from '../shared/quote-badges';
import { RateOption, TransportLeg } from '@/types/quote-breakdown';

const mapLegsForVisualizer = (legs?: TransportLeg[]) => {
    if (!legs) return [];
    return legs.map(leg => ({
        ...leg,
        from: leg.origin,
        to: leg.destination,
        mode: leg.mode as 'ocean' | 'air' | 'road' | 'rail'
    }));
};

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
    const [expandedId, setExpandedId] = useState<string | null>(null);

    if (!results || results.length === 0) return null;

    const toggleExpand = (id: string) => {
        setExpandedId(prev => prev === id ? null : id);
    };

    const renderCardView = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((option) => {
                const isSelected = selectedIds.includes(option.id);
                return (
                    <Card 
                        key={option.id} 
                        className={cn(
                            "cursor-pointer transition-all hover:shadow-md border-2",
                            isSelected ? "border-primary bg-primary/5" : "border-transparent hover:border-muted-foreground/20",
                            expandedId === option.id ? "ring-2 ring-primary/20" : ""
                        )}
                        onClick={() => onToggleSelection ? onToggleSelection(option.id) : onSelect(option)}
                    >
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start gap-2">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                        {onToggleSelection && (
                                            <Checkbox 
                                                checked={isSelected}
                                                onCheckedChange={() => onToggleSelection(option.id)}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        )}
                                        <h4 className="font-bold text-lg mr-1 truncate">{option.carrier}</h4>
                                        {getTierBadge(option.tier)}
                                        {option.source_attribution?.includes("AI") && (
                                            <Badge variant="secondary" className="bg-purple-100 text-purple-700 hover:bg-purple-100 text-[10px] px-1 h-5 whitespace-nowrap">
                                                AI Generated
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-sm text-muted-foreground truncate" title={option.name}>{option.name}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-xl font-bold text-primary whitespace-nowrap">
                                        {formatCurrency(option.price, option.currency)}
                                    </div>
                                    <div className="text-xs text-muted-foreground">Total Estimate</div>
                                    
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
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="space-y-1">
                                    <span className="text-xs text-muted-foreground block">Service</span>
                                    <div className="font-medium flex items-center gap-1">
                                        {getModeIcon(option.transport_mode || 'ocean')}
                                        {option.route_type || 'Standard'}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs text-muted-foreground block">Transit Time</span>
                                    <div className="font-medium">{option.transitTime}</div>
                                </div>
                            </div>

                            <div className="pt-2 border-t grid grid-cols-2 gap-2">
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
                                        toggleExpand(option.id);
                                    }}
                                >
                                    {expandedId === option.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
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

                            {expandedId === option.id && (
                                <div className="mt-4 pt-4 border-t animate-in fade-in slide-in-from-top-2 duration-200" onClick={(e) => e.stopPropagation()}>
                                    <Tabs defaultValue="details" className="w-full">
                                        <TabsList className="grid w-full grid-cols-2 mb-4">
                                            <TabsTrigger value="details" className="text-xs h-7"><LayoutList className="w-3 h-3 mr-2"/>Breakdown</TabsTrigger>
                                            <TabsTrigger value="map" className="text-xs h-7"><MapIcon className="w-3 h-3 mr-2"/>Map</TabsTrigger>
                                        </TabsList>
                                        
                                        <TabsContent value="details">
                                            <QuoteDetailView 
                                                quote={mapOptionToQuote(option)} 
                                                compact={true}
                                            />
                                        </TabsContent>

                                        <TabsContent value="map">
                                                        <QuoteMapVisualizer 
                                                            origin={option.legs?.[0]?.origin || "Origin"} 
                                                            destination={option.legs?.[option.legs.length - 1]?.destination || "Destination"}
                                                            legs={mapLegsForVisualizer(option.legs) || []}
                                                        />
                                                    </TabsContent>
                                    </Tabs>
                                </div>
                            )}
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
                            expandedId === option.id ? "ring-2 ring-primary/20" : ""
                        )}
                        onClick={() => toggleExpand(option.id)}
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
                                            toggleExpand(option.id);
                                        }}
                                    >
                                        {expandedId === option.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
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
                        
                        {/* Expandable content for List View */}
                        {expandedId === option.id && (
                             <div className="w-full px-4 pb-4 border-t pt-4 cursor-default" onClick={(e) => e.stopPropagation()}>
                                <Tabs defaultValue="details" className="w-full">
                                    <TabsList className="grid w-full max-w-md grid-cols-2 mb-4">
                                        <TabsTrigger value="details" className="text-xs h-7"><LayoutList className="w-3 h-3 mr-2"/>Breakdown</TabsTrigger>
                                        <TabsTrigger value="map" className="text-xs h-7"><MapIcon className="w-3 h-3 mr-2"/>Map</TabsTrigger>
                                    </TabsList>
                                    
                                    <TabsContent value="details">
                                        <QuoteDetailView 
                                            quote={mapOptionToQuote(option)} 
                                            compact={true}
                                        />
                                    </TabsContent>

                                    <TabsContent value="map">
                                        <QuoteMapVisualizer 
                                            origin={option.legs?.[0]?.origin || "Origin"} 
                                            destination={option.legs?.[option.legs.length - 1]?.destination || "Destination"}
                                            legs={mapLegsForVisualizer(option.legs) || []}
                                        />
                                    </TabsContent>
                                </Tabs>
                            </div>
                        )}
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
                                        if (option.id) toggleExpand(option.id);
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
                                                    toggleExpand(option.id);
                                                }}
                                            >
                                                {expandedId === option.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
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
                                {expandedId === option.id && (
                                    <TableRow>
                                        <TableCell colSpan={9} className="p-0">
                                            <div className="p-4 bg-muted/30">
                                                <Tabs defaultValue="details" className="w-full">
                                                    <TabsList className="grid w-full max-w-md grid-cols-2 mb-4">
                                                        <TabsTrigger value="details" className="text-xs h-7"><LayoutList className="w-3 h-3 mr-2"/>Breakdown</TabsTrigger>
                                                        <TabsTrigger value="map" className="text-xs h-7"><MapIcon className="w-3 h-3 mr-2"/>Map</TabsTrigger>
                                                    </TabsList>
                                                    
                                                    <TabsContent value="details">
                                                        <QuoteDetailView 
                                                            quote={mapOptionToQuote(option)} 
                                                            compact={true}
                                                        />
                                                    </TabsContent>

                                                    <TabsContent value="map">
                                                        <QuoteMapVisualizer 
                                                            origin={option.legs?.[0]?.origin || "Origin"} 
                                                            destination={option.legs?.[option.legs.length - 1]?.destination || "Destination"}
                                                            legs={mapLegsForVisualizer(option.legs) || []}
                                                        />
                                                    </TabsContent>
                                                </Tabs>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
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
        </div>
    );
}
