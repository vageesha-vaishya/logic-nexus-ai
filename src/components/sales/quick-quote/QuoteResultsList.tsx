import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { QuoteLegsVisualizer } from './QuoteLegsVisualizer';
import { Sparkles, Leaf, Timer, ShieldCheck, DollarSign } from 'lucide-react';

interface RateOption {
    id: string;
    carrier: string;
    name: string;
    price: number;
    currency: string;
    transitTime: string;
    tier: string;
    legs?: any[];
    reliability?: { score: number; on_time_performance: string };
    environmental?: { co2_emissions: string; rating: string };
    source_attribution?: string;
    ai_explanation?: string;
}

interface QuoteResultsListProps {
    results: RateOption[];
    onSelect: (option: RateOption) => void;
}

export function QuoteResultsList({ results, onSelect }: QuoteResultsListProps) {
    if (!results || results.length === 0) return null;

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
            {results.map((option) => (
                <Card key={option.id} className="relative overflow-hidden hover:border-primary transition-all duration-200 group border-l-4 border-l-transparent hover:border-l-primary hover:shadow-md">
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start mb-4">
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
                            <div className="text-right">
                                <div className="text-2xl font-bold text-primary">
                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: option.currency }).format(option.price)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    Est. Transit: <span className="font-medium text-foreground">{option.transitTime}</span>
                                </div>
                                <Button size="sm" className="mt-2 h-7 text-xs" onClick={() => onSelect(option)}>Select Quote</Button>
                            </div>
                        </div>

                        {/* Extended Details for AI Quotes */}
                        {(option.reliability || option.environmental) && (
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
                                {option.environmental && (
                                    <div>
                                        <span className="font-semibold block mb-1">Environmental</span>
                                        <div className="flex justify-between text-muted-foreground">
                                            <span>CO2: {option.environmental.co2_emissions}</span>
                                            <span>Rating: {option.environmental.rating}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* AI Explanation */}
                        {option.ai_explanation && (
                            <div className="mb-2 text-xs text-purple-700 bg-purple-50 p-2 rounded border border-purple-100 flex items-start gap-2">
                                <Sparkles className="w-3 h-3 mt-0.5 shrink-0" />
                                <span>{option.ai_explanation}</span>
                            </div>
                        )}

                        {/* Visual Legs */}
                        {option.legs && option.legs.length > 0 && (
                            <QuoteLegsVisualizer legs={option.legs} />
                        )}
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
