import { useEffect, useState } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, History, ArrowRight, Plane, Ship, Truck, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface QuickQuoteHistoryProps {
  onSelect: (data: any) => void;
  className?: string;
}

export function QuickQuoteHistory({ onSelect, className }: QuickQuoteHistoryProps) {
  const { scopedDb, context } = useCRM();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const fetchHistory = async () => {
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
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, context?.tenantId]);

  const getIcon = (mode: string) => {
    switch (mode?.toLowerCase()) {
      case 'air': return <Plane className="h-4 w-4" />;
      case 'ocean': return <Ship className="h-4 w-4" />;
      case 'road': return <Truck className="h-4 w-4" />;
      default: return <Ship className="h-4 w-4" />;
    }
  };

  const handleSelect = (item: any) => {
    // Reconstruct the payload expected by QuoteNew
    // We combine the original request payload with the AI response options
    const payload = {
      ...item.request_payload,
      selectedRates: item.response_payload?.options || [], // Load ALL options
      marketAnalysis: item.response_payload?.market_analysis,
      confidenceScore: item.response_payload?.confidence_score,
      anomalies: item.response_payload?.anomalies
    };
    
    onSelect(payload);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <History className="mr-2 h-4 w-4" />
          History
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Recent AI Quote Requests</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden mt-4">
            {loading ? (
                <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : history.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">
                    No recent history found.
                </div>
            ) : (
                <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-3">
                        {history.map((item) => (
                            <Card key={item.id} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => handleSelect(item)}>
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="flex items-center gap-1">
                                                {getIcon(item.request_payload.mode)}
                                                {item.request_payload.mode?.toUpperCase()}
                                            </Badge>
                                            <span className="text-sm text-muted-foreground flex items-center">
                                                <Clock className="h-3 w-3 mr-1" />
                                                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                                            </span>
                                        </div>
                                        <Badge variant={item.status === 'converted' ? 'default' : 'secondary'}>
                                            {item.status}
                                        </Badge>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 text-sm font-medium mb-2">
                                        <span>{item.request_payload.origin}</span>
                                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                        <span>{item.request_payload.destination}</span>
                                    </div>
                                    
                                    <div className="text-xs text-muted-foreground">
                                        {item.request_payload.commodity} • {item.response_payload?.options?.length || 0} Options Generated
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </ScrollArea>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
