import { useEffect, useState, useCallback } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, History, ArrowRight, Plane, Ship, Truck, Clock, FileText, CheckCircle, AlertCircle, Sparkles, ArrowLeft, CheckSquare, Square, Train } from 'lucide-react';
import { logger } from '@/lib/logger';
import { formatDistanceToNow } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { RateOption } from '@/types/quote-breakdown';
import { Separator } from "@/components/ui/separator";

interface QuickQuoteHistoryProps {
  onSelect: (data: any) => void;
  className?: string;
}

export function QuickQuoteHistory({ onSelect, className }: QuickQuoteHistoryProps) {
  const { scopedDb, context, supabase } = useCRM();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  // Selection State
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [selectedRateIds, setSelectedRateIds] = useState<string[]>([]);

  const fetchHistory = useCallback(async () => {
    if (!context?.tenantId) return;
    
    setLoading(true);
    try {
      const { data, error } = await scopedDb
        .from('ai_quote_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      console.error('Failed to fetch AI quote history:', err);
    } finally {
      setLoading(false);
    }
  }, [context?.tenantId, scopedDb]);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
      setSelectedItem(null); // Reset selection on open
    }
  }, [isOpen, fetchHistory]);

  // Real-time sync for history
  useEffect(() => {
    if (!isOpen || !context?.tenantId || !supabase) return;

    const channel = supabase
      .channel('ai-quote-history-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_quote_requests',
          filter: `tenant_id=eq.${context.tenantId}`
        },
        (payload) => {
          logger.info('[QuickQuoteHistory] Real-time update received:', { eventType: payload.eventType });
          fetchHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, context?.tenantId, supabase, fetchHistory]);

  const getIcon = (mode: string) => {
    switch (mode?.toLowerCase()) {
      case 'air': return <Plane className="h-4 w-4" />;
      case 'ocean': return <Ship className="h-4 w-4" />;
      case 'rail': return <Train className="h-4 w-4" />;
      case 'road': return <Truck className="h-4 w-4" />;
      default: return <Ship className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
      switch (status) {
          case 'generated':
              return <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200">Generated</Badge>;
          case 'converted':
              return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Converted</Badge>;
          case 'confirmed':
              return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Confirmed</Badge>;
          case 'pending_review':
              return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Pending Review</Badge>;
          default:
              return <Badge variant="outline">{status}</Badge>;
      }
  };

  const getPriceRange = (options: RateOption[]) => {
      if (!options || options.length === 0) return null;
      const prices = options.map(o => o.price);
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const currency = options[0].currency;
      
      if (min === max) return `${currency} ${min.toLocaleString()}`;
      return `${currency} ${min.toLocaleString()} - ${max.toLocaleString()}`;
  };

  const handleItemClick = (item: any) => {
      setSelectedItem(item);
      // Default: Select all rates
      const options = item.response_payload?.options as RateOption[] || [];
      setSelectedRateIds(options.map(o => o.id));
  };

  const handleBackToList = () => {
      setSelectedItem(null);
      setSelectedRateIds([]);
  };

  const handleCreateQuote = () => {
      if (!selectedItem) return;

      const allOptions = selectedItem.response_payload?.options as RateOption[] || [];
      const filteredOptions = allOptions.filter(o => selectedRateIds.includes(o.id));

      if (filteredOptions.length === 0) {
          return; // Should show error/toast ideally, but button disabled handles it
      }

      const payload = {
        ...selectedItem.request_payload,
        selectedRates: filteredOptions,
        marketAnalysis: selectedItem.response_payload?.market_analysis,
        confidenceScore: selectedItem.response_payload?.confidence_score,
        anomalies: selectedItem.response_payload?.anomalies,
        historyId: selectedItem.id
      };
      
      onSelect(payload);
      setIsOpen(false);
  };

  const handleUseParamsOnly = () => {
      if (!selectedItem) return;

      const payload = {
          ...selectedItem.request_payload,
          selectedRates: [], // Empty rates triggers "Draft" mode in QuoteNew
          historyId: selectedItem.id
      };

      onSelect(payload);
      setIsOpen(false);
  };

  const toggleRateSelection = (id: string) => {
      setSelectedRateIds(prev => 
          prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      );
  };

  const toggleSelectAll = () => {
      if (!selectedItem) return;
      const options = selectedItem.response_payload?.options as RateOption[] || [];
      if (selectedRateIds.length === options.length) {
          setSelectedRateIds([]);
      } else {
          setSelectedRateIds(options.map(o => o.id));
      }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className={className}>
          <History className="mr-2 h-4 w-4" />
          AI Quote History
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
              {selectedItem && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={handleBackToList}>
                      <ArrowLeft className="h-4 w-4" />
                  </Button>
              )}
              <DialogTitle>
                  {selectedItem ? 'Review AI Quote' : 'Recent AI Quote Requests'}
              </DialogTitle>
          </div>
          <DialogDescription>
            {selectedItem 
                ? 'Select the options you want to include in the new quote.' 
                : 'Select a previous request to create a new quote or review options.'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden mt-4">
            {loading ? (
                <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : !selectedItem ? (
                // LIST VIEW
                history.length === 0 ? (
                    <div className="text-center p-12 text-muted-foreground border-2 border-dashed rounded-lg">
                        <History className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p>No recent AI quotes found.</p>
                        <p className="text-sm mt-2">Generate a Quick Quote to see it here.</p>
                    </div>
                ) : (
                    <ScrollArea className="h-[500px] pr-4">
                        <div className="space-y-3">
                            {history.map((item) => {
                                const options = item.response_payload?.options as RateOption[] || [];
                                const priceRange = getPriceRange(options);
                                
                                return (
                                    <Card key={item.id} className="cursor-pointer hover:bg-accent/50 transition-colors border-l-4 border-l-primary/20 hover:border-l-primary group" onClick={() => handleItemClick(item)}>
                                        <CardContent className="p-4">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-muted rounded-full group-hover:bg-background transition-colors">
                                                        {getIcon(item.request_payload.mode)}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 font-medium">
                                                            <span>{item.request_payload.origin}</span>
                                                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                                            <span>{item.request_payload.destination}</span>
                                                        </div>
                                                        <div className="text-xs text-muted-foreground flex items-center mt-1">
                                                            <Clock className="h-3 w-3 mr-1" />
                                                            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                                                        </div>
                                                    </div>
                                                </div>
                                                {getStatusBadge(item.status)}
                                            </div>
                                            
                                            <div className="grid grid-cols-3 gap-4 text-sm mt-3 bg-muted/30 p-3 rounded-md group-hover:bg-muted/50 transition-colors">
                                                <div>
                                                    <span className="text-muted-foreground text-xs block">Commodity</span>
                                                    <span className="font-medium">{item.request_payload.commodity}</span>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground text-xs block">Options</span>
                                                    <span className="font-medium">{options.length} Generated</span>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground text-xs block">Est. Cost</span>
                                                    <span className="font-medium text-primary">{priceRange || 'N/A'}</span>
                                                </div>
                                            </div>
                                            
                                            {item.response_payload?.market_analysis && (
                                                <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground bg-blue-50/50 p-2 rounded dark:bg-blue-950/20">
                                                    <Sparkles className="h-3 w-3 text-blue-500 mt-0.5" />
                                                    <p className="line-clamp-2">{item.response_payload.market_analysis}</p>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </ScrollArea>
                )
            ) : (
                // DETAIL VIEW
                <div className="flex flex-col h-full">
                    {/* Summary Header */}
                    <div className="bg-muted/30 p-4 rounded-lg mb-4 grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-xs text-muted-foreground block">Route</span>
                            <div className="font-medium flex items-center gap-2">
                                {selectedItem.request_payload.origin} 
                                <ArrowRight className="h-3 w-3" /> 
                                {selectedItem.request_payload.destination}
                            </div>
                        </div>
                        <div>
                            <span className="text-xs text-muted-foreground block">Cargo</span>
                            <div className="font-medium">
                                {selectedItem.request_payload.commodity} • {selectedItem.request_payload.weight || 'N/A'} kg
                            </div>
                        </div>
                    </div>

                    {/* Market Analysis */}
                    {selectedItem.response_payload?.market_analysis && (
                        <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg mb-4 text-sm text-blue-800 dark:text-blue-300 flex gap-2">
                             <Sparkles className="h-4 w-4 mt-0.5 shrink-0" />
                             <p>{selectedItem.response_payload.market_analysis}</p>
                        </div>
                    )}

                    {/* Options List */}
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-sm">Generated Options</h4>
                        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={toggleSelectAll}>
                            {selectedRateIds.length === (selectedItem.response_payload?.options?.length || 0) 
                                ? "Deselect All" 
                                : "Select All"}
                        </Button>
                    </div>
                    
                    <ScrollArea className="flex-1 -mx-2 px-2">
                        <div className="space-y-2 pb-4">
                            {(selectedItem.response_payload?.options as RateOption[] || []).map((option) => (
                                <div 
                                    key={option.id} 
                                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                        selectedRateIds.includes(option.id) 
                                            ? 'bg-primary/5 border-primary shadow-sm' 
                                            : 'bg-card border-border hover:bg-accent/50'
                                    }`}
                                    onClick={() => toggleRateSelection(option.id)}
                                >
                                    <Checkbox 
                                        checked={selectedRateIds.includes(option.id)} 
                                        onCheckedChange={() => toggleRateSelection(option.id)}
                                        className="mt-1"
                                    />
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="font-medium">{option.carrier}</div>
                                                <div className="text-xs text-muted-foreground">{option.name || option.tier}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold text-primary">
                                                    {option.currency} {option.price.toLocaleString()}
                                                </div>
                                                <div className="text-xs text-muted-foreground">{option.transitTime}</div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex gap-2 mt-2">
                                            {option.tier && <Badge variant="secondary" className="text-[10px] h-5">{option.tier}</Badge>}
                                            {option.co2_kg && <Badge variant="outline" className="text-[10px] h-5">{option.co2_kg} kg CO₂</Badge>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>

                    {/* Footer Actions */}
                    <div className="mt-4 pt-4 border-t flex justify-between items-center gap-4">
                        <Button variant="ghost" onClick={handleUseParamsOnly}>
                            Use Params Only
                        </Button>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleBackToList}>
                                Cancel
                            </Button>
                            <Button onClick={handleCreateQuote}>
                                Create Quote ({selectedRateIds.length})
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
