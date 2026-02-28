import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Check, Star, TrendingDown, Clock, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuoteOption {
  id: string;
  carrier_name: string;
  total_amount: number;
  currency: string;
  transit_time_days: number | null;
  reliability_score?: number;
  is_recommended?: boolean;
  rank_score?: number;
  rank_details?: {
    cost_score: number;
    time_score: number;
    reliability_score: number;
  };
}

interface ComparisonDashboardProps {
  options: QuoteOption[];
  onSelect: (optionId: string) => void;
  selectedOptionId?: string | null;
}

export function QuotationComparisonDashboard({ options, onSelect, selectedOptionId }: ComparisonDashboardProps) {
  // Sort options by rank_score descending (highest score first)
  const sortedOptions = useMemo(() => {
    return [...options].sort((a, b) => (b.rank_score || 0) - (a.rank_score || 0));
  }, [options]);

  if (!options.length) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Option Comparison</h3>
        <Badge variant="outline">{options.length} Options Available</Badge>
      </div>

      <ScrollArea className="w-full whitespace-nowrap rounded-md border">
        <div className="flex w-max space-x-4 p-4">
          {sortedOptions.map((option) => (
            <Card 
              key={option.id}
              className={cn(
                "w-[300px] shrink-0 transition-all hover:shadow-md cursor-pointer border-2 relative",
                selectedOptionId === option.id ? "border-primary bg-primary/5" : "border-transparent",
                option.is_recommended && selectedOptionId !== option.id ? "border-amber-400 bg-amber-50/30" : ""
              )}
              onClick={() => onSelect(option.id)}
            >
              {option.is_recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
                  <Star className="w-3 h-3 fill-white" /> Recommended
                </div>
              )}
              
              <CardHeader className="pb-2 pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base font-bold">{option.carrier_name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Option #{option.id.slice(0,4)}</p>
                  </div>
                  {selectedOptionId === option.id && (
                    <div className="bg-primary text-primary-foreground rounded-full p-1">
                      <Check className="w-4 h-4" />
                    </div>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: option.currency }).format(option.total_amount)}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center py-1 border-b border-dashed">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="w-4 h-4" /> Transit Time
                    </span>
                    <span className="font-medium">{option.transit_time_days || 'TBD'} days</span>
                  </div>
                  
                  <div className="flex justify-between items-center py-1 border-b border-dashed">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <ShieldCheck className="w-4 h-4" /> Reliability
                    </span>
                    <span className={cn(
                      "font-medium",
                      (option.reliability_score || 0) > 0.8 ? "text-green-600" : "text-amber-600"
                    )}>
                      {option.reliability_score ? `${Math.round(option.reliability_score * 100)}%` : 'N/A'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <TrendingDown className="w-4 h-4" /> Rank Score
                    </span>
                    <Badge variant="secondary">
                      {option.rank_score?.toFixed(1) || '0.0'}
                    </Badge>
                  </div>

                  {option.rank_details && (
                    <div className="pt-2 text-xs grid grid-cols-3 gap-1">
                      <div className="text-center bg-muted p-1 rounded">
                        <div className="text-muted-foreground">Cost</div>
                        <div className="font-bold">{option.rank_details.cost_score}</div>
                      </div>
                      <div className="text-center bg-muted p-1 rounded">
                        <div className="text-muted-foreground">Time</div>
                        <div className="font-bold">{option.rank_details.time_score}</div>
                      </div>
                      <div className="text-center bg-muted p-1 rounded">
                        <div className="text-muted-foreground">Rel</div>
                        <div className="font-bold">{option.rank_details.reliability_score}</div>
                      </div>
                    </div>
                  )}
                </div>

                <Button 
                  className="w-full mt-2" 
                  variant={selectedOptionId === option.id ? "default" : "outline"}
                >
                  {selectedOptionId === option.id ? 'Selected' : 'Select Option'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
