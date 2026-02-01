
import { useState, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { History, ArrowRight, User } from 'lucide-react';

interface AuditLog {
  id: string;
  action: string;
  details: any;
  created_at: string;
  user_email: string;
  user_full_name: string;
}

interface ServiceHistoryPanelProps {
  serviceId: string;
  resourceType?: 'services' | 'service_pricing_tiers';
}

export function ServiceHistoryPanel({ serviceId, resourceType = 'services' }: ServiceHistoryPanelProps) {
  const { scopedDb } = useCRM();
  const [history, setHistory] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
    
    // Subscribe to real-time updates
    const channel = scopedDb.client
      .channel(`audit_logs_${serviceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'audit_logs',
          filter: `resource_id=eq.${serviceId}`,
        },
        (payload) => {
          // Since we need user details, we'll refetch or optimistic update if we had user info
          // For simplicity and correctness, we refetch the latest
          fetchHistory();
        }
      )
      .subscribe();

    return () => {
      scopedDb.client.removeChannel(channel);
    };
  }, [serviceId, resourceType, scopedDb.client]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const rpcName = resourceType === 'services' ? 'get_service_history' : 'get_tier_history';
      const params = resourceType === 'services' 
        ? { p_service_id: serviceId } 
        : { p_tier_id: serviceId };

      const { data, error } = await scopedDb.client.rpc(rpcName, params);

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDiff = (details: any) => {
    if (!details) return null;
    
    // Handle different action types based on details structure
    const changedFields = details.changed_fields || {};
    const oldValues = details.old_values || {};
    const newValues = details.new_values || {};

    if (Object.keys(changedFields).length > 0) {
      return (
        <div className="space-y-2 mt-2">
          {Object.entries(changedFields).map(([key, value]) => (
            <div key={key} className="text-sm grid grid-cols-[1fr,auto,1fr] gap-2 items-center p-2 bg-muted/30 rounded">
              <span className="font-mono text-muted-foreground">{key}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="line-through text-xs text-muted-foreground opacity-70">
                  {JSON.stringify(oldValues[key])}
                </span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  {JSON.stringify(value)}
                </span>
              </div>
            </div>
          ))}
        </div>
      );
    }
    
    if (details.new_values && !details.old_values) {
        return <div className="text-sm text-green-600 mt-1">Created new record</div>;
    }

    if (details.old_values && !details.new_values) {
        return <div className="text-sm text-red-600 mt-1">Deleted record</div>;
    }

    return null;
  };

  if (loading && history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <History className="h-5 w-5" />
          History & Audit Trail
        </CardTitle>
        <CardDescription>Track changes and updates</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-6">
            {history.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No history available
              </div>
            ) : (
              history.map((log) => (
                <div key={log.id} className="relative pl-6 border-l-2 border-muted pb-6 last:pb-0">
                  <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-background border-2 border-primary" />
                  
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm flex items-center gap-2">
                        <User className="h-3 w-3" />
                        {log.user_full_name || log.user_email || 'System'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), 'MMM d, yyyy HH:mm')}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs font-mono">
                        {log.action.replace('PRICING_', '')}
                      </Badge>
                    </div>

                    {formatDiff(log.details)}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
