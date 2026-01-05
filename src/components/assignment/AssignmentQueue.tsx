import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Props {
  onUpdate?: () => void;
}

export function AssignmentQueue({ onUpdate }: Props) {
  const { supabase, context } = useCRM();
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'failed'>('all');

  useEffect(() => {
    fetchQueue();

    const channel = supabase
      .channel('assignment-queue-list')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lead_assignment_queue'
        },
        () => {
          fetchQueue();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchQueue = async () => {
    try {
      // We rely on RLS for tenant isolation
      const { data, error } = await supabase
        .from('lead_assignment_queue')
        .select('*, leads(first_name, last_name, company)')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      console.log('Queue fetched:', data?.length, 'items');
      setQueue(data || []);
    } catch (error: any) {
      toast.error('Failed to load queue');
      console.error('Error fetching queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (queueId: string) => {
    try {
      const { error } = await supabase
        .from('lead_assignment_queue')
        .update({ status: 'pending', error_message: null })
        .eq('id', queueId);

      if (error) throw error;
      toast.success('Queued for retry');
      fetchQueue();
      onUpdate?.();
    } catch (error: any) {
      toast.error('Failed to retry');
      console.error('Error:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'processing':
        return <RefreshCw className="h-4 w-4 animate-spin" />;
      case 'assigned':
        return <CheckCircle className="h-4 w-4" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'secondary';
      case 'processing':
        return 'default';
      case 'assigned':
        return 'default';
      case 'failed':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading queue...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Assignment Queue</h3>
          <p className="text-sm text-muted-foreground">
            View and manage pending lead assignments
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={filter === 'pending' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setFilter(filter === 'pending' ? 'all' : 'pending')}
          >
            Pending Only
          </Button>
          <Button onClick={fetchQueue} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {queue.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No items in queue</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {queue
            .filter(item => filter === 'all' || (item.status && item.status.toLowerCase() === filter))
            .map((item) => (
            <Card key={item.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(item.status)}
                      <Badge variant={getStatusColor(item.status) as any}>
                        {item.status}
                      </Badge>
                    </div>

                    <div className="flex-1">
                      <h4 className="font-semibold">
                        {item.leads?.first_name} {item.leads?.last_name}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {item.leads?.company || 'No company'}
                      </p>
                      {item.error_message && (
                        <p className="text-sm text-destructive mt-1">
                          Error: {item.error_message}
                        </p>
                      )}
                    </div>

                    <div className="text-sm text-muted-foreground text-right">
                      <p>Priority: {item.priority}</p>
                      <p>Created: {format(new Date(item.created_at), 'MMM d, HH:mm')}</p>
                      {item.retry_count > 0 && <p>Retries: {item.retry_count}</p>}
                    </div>
                  </div>

                  {item.status === 'failed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRetry(item.id)}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Retry
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
