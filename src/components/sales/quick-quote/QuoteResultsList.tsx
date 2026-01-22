import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { QuoteLegsVisualizer } from './QuoteLegsVisualizer';
import { QuoteDetailView } from './QuoteDetailView';
import { QuoteMapVisualizer } from './QuoteMapVisualizer';
import { Sparkles, Leaf, Timer, ShieldCheck, DollarSign, ChevronDown, ChevronUp, Map as MapIcon, LayoutList } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface RateOption {
    id: string;
    carrier: string;
    name: string;
    price: number;
    currency: string;
    transitTime: string;
    tier: 'contract' | 'spot' | 'market' | 'best_value' | 'cheapest' | 'fastest' | 'greenest' | 'reliable' | string;
    legs?: any[];
    price_breakdown?: any;
    reliability?: { score: number; on_time_performance: string };
    environmental?: { co2_emissions: string; rating: string };
    source_attribution?: string;
    ai_explanation?: string;
    transport_mode?: string;
    co2_kg?: number;
    route_type?: 'Direct' | 'Transshipment';
    stops?: number;
}

interface QuoteResultsListProps {
    results: RateOption[];
    onSelect: (option: RateOption) => void;
    selectedIds?: string[];
    onToggleSelection?: (id: string) => void;
}

export function QuoteResultsList({ results, onSelect, selectedIds = [], onToggleSelection }: QuoteResultsListProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    if (!results || results.length === 0) return null;

    const toggleExpand = (id: string) => {
        setExpandedId(prev => prev === id ? null : id);
    };

    const getTierBadge = (tier: string) => {
        switch (tier) {
            case 'contract': return <Badge className="bg-green-600">Contract</Badge>;
            case 'spot': return <Badge className="bg-blue-600">Spot</Badge>;
            case 'best_value': return <Badge className="bg-purple-600"><Sparkles className="w-3 h-3 mr-1"/> Best Value</Badge>;
            case 'cheapest': return <Badge className="bg-emerald-600"><DollarSign className="w-3 h-3 mr-1"/> Cheapest</Badge>;
            case 'fastest': return <Badge className="bg-amber-600"><Timer className="w-3 h-3 mr-1"/> Fastest</Badge>;
            case 'greenest': return <Badge className="bg-green-500"><Leaf className="w-3 h-3 mr-1"/> Eco-Friendly</Badge>;
            case 'reliable': return <Badge className="bg-blue-500"><ShieldCheck className="w-3 h-3 mr-1"/> Most Reliable</Badge>;
            default: return <Badge variant="outline">{tier}</Badge>;
        }
    };

    return (
        <div className="space-y-4">
            {results.map((option) => {
                const isSelected = selectedIds.includes(option.id);
                return (
                <Card 
                    key={option.id} 
                    className={`relative overflow-hidden transition-all duration-200 group border-l-4 hover:shadow-md 
                        ${isSelected ? 'border-l-primary ring-2 ring-primary/20' : 'border-l-transparent hover:border-l-primary'}
                        ${expandedId === option.id ? 'border-primary' : ''}`}
                >
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-start gap-3">
                                {onToggleSelection && (
                                    <Checkbox 
                                        checked={isSelected}
                                        onCheckedChange={() => onToggleSelection(option.id)}
                                        className="mt-1"
                                    />
                                )}
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-semibold text-lg">{option.carrier}</span>
                                    {getTierBadge(option.tier)}
                                    {option.source_attribution && option.source_attribution.includes("AI") && (
                                        <Badge variant="secondary" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                                            AI Generated
                                        </Badge>
                                    )}
                                </div>
                                <div className="text-sm text-muted-foreground">{option.name}</div>
                                {option.source_attribution && (
                                    <div className="text-[10px] text-muted-foreground italic">Source: {option.source_attribution}</div>
                                )}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-bold text-primary">
                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: option.currency }).format(option.price)}
                                </div>
                                <div className="text-xs text-muted-foreground space-y-1">
                                    <div>Est. Transit: <span className="font-medium text-foreground">{option.transitTime}</span></div>
                                    {option.route_type && (
                                        <div className="flex items-center justify-end gap-2">
                                            <Badge variant="outline" className="text-[10px] h-5">{option.route_type}</Badge>
                                            {option.stops !== undefined && (
                                                <Badge variant="outline" className="text-[10px] h-5">{option.stops} Stops</Badge>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-2 mt-2 justify-end">
                                    <Button 
                                        size="sm" 
                                        variant="outline" 
                                        className="h-7 text-xs" 
                                        onClick={() => toggleExpand(option.id)}
                                    >
                                        {expandedId === option.id ? <ChevronUp className="w-3 h-3 mr-1"/> : <ChevronDown className="w-3 h-3 mr-1"/>}
                                        Details
                                    </Button>
                                    <Button size="sm" className="h-7 text-xs" onClick={() => onSelect(option)}>Select Quote</Button>
                                </div>
                            </div>
                        </div>

                        {/* Extended Details for AI Quotes & Standard Rates */}
                        {!expandedId && (option.reliability || option.environmental || option.co2_kg) && (
                            <div className="grid grid-cols-2 gap-4 mb-2 p-3 bg-muted/30 rounded-md text-xs">
                                {option.reliability && (
                                    <div>
                                        <span className="font-semibold block mb-1">Reliability</span>
                                        <div className="flex justify-between text-muted-foreground">
                                            <span>Score: {option.reliability.score}/10</span>
                                            <span>On-Time: {option.reliability.on_time_performance}</span>
                                        </div>
                                    </div>
                                )}
                                {(option.environmental || option.co2_kg) && (
                                    <div>
                                        <span className="font-semibold block mb-1">Environmental</span>
                                        <div className="flex justify-between text-muted-foreground">
                                            <span>CO2: {option.co2_kg ? `${option.co2_kg} kg` : option.environmental?.co2_emissions}</span>
                                            <span>Rating: {option.environmental?.rating || (option.co2_kg ? (option.co2_kg < 1000 ? 'A' : 'B') : 'N/A')}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* AI Explanation */}
                        {!expandedId && option.ai_explanation && (
                            <div className="mb-2 text-xs text-purple-700 bg-purple-50 p-2 rounded border border-purple-100 flex items-start gap-2">
                                <Sparkles className="w-3 h-3 mt-0.5 shrink-0" />
                                <span>{option.ai_explanation}</span>
                            </div>
                        )}

                        {/* Visual Legs */}
                        {!expandedId && option.legs && option.legs.length > 0 && (
                            <QuoteLegsVisualizer legs={option.legs} />
                        )}

                        {/* Expanded Detail View */}
                        {expandedId === option.id && (
                            <div className="mt-4 pt-4 border-t animate-in fade-in slide-in-from-top-2 duration-200">
                                <Tabs defaultValue="details" className="w-full">
                                    <TabsList className="grid w-full grid-cols-2 mb-4">
                                        <TabsTrigger value="details" className="text-xs h-7"><LayoutList className="w-3 h-3 mr-2"/>Cost & Leg Breakdown</TabsTrigger>
                                        <TabsTrigger value="map" className="text-xs h-7"><MapIcon className="w-3 h-3 mr-2"/>Route Map</TabsTrigger>
                                    </TabsList>
                                    
                                    <TabsContent value="details">
                                        <QuoteDetailView 
                                            quote={{
                                                ...option,
                                                transport_mode: option.name, // Mapping fallback
                                                carrier: { name: option.carrier }, // Mapping fallback
                                                transit_time: { details: option.transitTime }, // Mapping fallback
                                                price_breakdown: option.price_breakdown || {
                                                    total: option.price,
                                                    currency: option.currency,
                                                    base_fare: option.price * 0.8,
                                                    taxes: option.price * 0.1,
                                                    surcharges: { 'Fuel': option.price * 0.05, 'Security': option.price * 0.05 },
                                                    fees: {}
                                                }
                                            }} 
                                        />
                                    </TabsContent>

                                    <TabsContent value="map">
                                        <QuoteMapVisualizer 
                                            origin={option.legs?.[0]?.from || "Origin"} 
                                            destination={option.legs?.[option.legs.length - 1]?.to || "Destination"}
                                            legs={option.legs || []}
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
}
