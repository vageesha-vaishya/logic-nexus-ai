import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowRight, ArrowLeftRight, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { TransferService } from '@/lib/transfer-service';
import { WidgetProps } from '@/types/dashboard';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export function TransfersWidget({ config }: WidgetProps) {
  const { t } = useTranslation();
  const { scopedDb, supabase, context } = useCRM();
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadData = async () => {
    try {
      const data = await TransferService.getTransfers(scopedDb, { status: 'pending' });
      setTransfers(data || []);
    } catch (error) {
      console.error('Failed to load transfers', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Realtime subscription
    // Subscribe to entity_transfers changes
    // We filter by tenant on the client side if needed, or rely on RLS/Postgres filter if possible
    // Since Realtime filters are limited, we'll subscribe to all and filter in callback or just reload
    const channel = supabase
      .channel('transfers-widget')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'entity_transfers',
        },
        (payload) => {
           // Reload on any change to transfers
           // Optimization: Check if payload.new or payload.old matches current tenant
           loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [scopedDb, supabase]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/50',
      completed: 'bg-green-100 text-green-800 dark:bg-green-950/50',
      rejected: 'bg-red-100 text-red-800 dark:bg-red-950/50',
      failed: 'bg-orange-100 text-orange-800 dark:bg-orange-950/50',
    };
    return <Badge variant="secondary" className={styles[status] || ''}>{status}</Badge>;
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4" />
            {config.title || t('Transfer Requests')}
          </CardTitle>
          <Badge variant="outline">{transfers.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-0">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-4">
            {loading ? (
              <div className="text-sm text-muted-foreground text-center py-4">{t('Loading...')}</div>
            ) : transfers.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">{t('No pending transfers')}</div>
            ) : (
              transfers.map((transfer) => (
                <div 
                  key={transfer.id} 
                  className="flex items-start justify-between space-x-4 border-b pb-4 last:border-0 last:pb-0 cursor-pointer hover:bg-muted/50 p-2 rounded-md transition-colors"
                  onClick={() => navigate('/dashboard/transfers')}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm capitalize">{transfer.transfer_type?.replace(/_/g, ' ')}</span>
                      {getStatusBadge(transfer.status)}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <span>{transfer.source_tenant?.name}</span>
                      <ArrowRight className="h-3 w-3" />
                      <span>{transfer.target_tenant?.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(transfer.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
      <div className="p-4 border-t pt-2">
        <Button variant="ghost" className="w-full h-8 text-xs" onClick={() => navigate('/dashboard/transfers')}>
          {t('View All Transfers')}
        </Button>
      </div>
    </Card>
  );
}
