import { useState, useEffect } from 'react';
import { TransferService } from '@/lib/transfer-service';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, Clock, CheckCircle, XCircle, AlertTriangle, Loader2, Plus } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { TransferStats } from '@/components/transfers/TransferStats';
import { TransferWizard } from '@/components/transfers/TransferWizard';
import { TransferDetailDialog } from '@/components/transfers/TransferDetailDialog';

export default function TransferCenter() {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, completed: 0, rejected: 0, failed: 0 });
  const [wizardOpen, setWizardOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const { toast } = useToast();
  const { context } = useCRM();

  const loadData = async () => {
    setLoading(true);
    try {
      const [transfersData, statsData] = await Promise.all([
        TransferService.getTransfers(),
        TransferService.getTransferStats(context?.tenantId),
      ]);
      setTransfers(transfersData || []);
      setStats(statsData);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const pendingTransfers = transfers.filter(t => t.status === 'pending');
  const historyTransfers = transfers.filter(t => t.status !== 'pending');

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
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transfer Center</h1>
          <p className="text-muted-foreground">Manage entity transfers between tenants and franchises</p>
        </div>
        <Button onClick={() => setWizardOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Transfer
        </Button>
      </div>

      <TransferStats stats={stats} />

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            Pending ({pendingTransfers.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <TransferTable transfers={pendingTransfers} loading={loading} onRowClick={setDetailId} getStatusBadge={getStatusBadge} />
        </TabsContent>
        <TabsContent value="history">
          <TransferTable transfers={historyTransfers} loading={loading} onRowClick={setDetailId} getStatusBadge={getStatusBadge} />
        </TabsContent>
      </Tabs>

      <TransferWizard open={wizardOpen} onOpenChange={setWizardOpen} onSuccess={loadData} />
      <TransferDetailDialog transferId={detailId} open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)} onActionComplete={loadData} />
    </div>
  );
}

function TransferTable({ transfers, loading, onRowClick, getStatusBadge }: any) {
  if (loading) return <Card><CardContent className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></CardContent></Card>;
  if (transfers.length === 0) return <Card><CardContent className="p-8 text-center text-muted-foreground">No transfers found</CardContent></Card>;

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Source</TableHead>
            <TableHead></TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transfers.map((t: any) => (
            <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onRowClick(t.id)}>
              <TableCell className="capitalize font-medium">{t.transfer_type.replace(/_/g, ' ')}</TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span>{t.source_tenant?.name}</span>
                  <span className="text-xs text-muted-foreground">{t.source_franchise?.name || 'Tenant Level'}</span>
                </div>
              </TableCell>
              <TableCell><ArrowRight className="h-4 w-4 text-muted-foreground" /></TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span>{t.target_tenant?.name}</span>
                  <span className="text-xs text-muted-foreground">{t.target_franchise?.name || 'Tenant Level'}</span>
                </div>
              </TableCell>
              <TableCell>{getStatusBadge(t.status)}</TableCell>
              <TableCell className="text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
