import { useState, useEffect } from 'react';
import { TransferService, EntityTransfer, TransferEntityType } from '@/lib/transfer-service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';

export default function TransferCenter() {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { context } = useCRM();

  const loadTransfers = async () => {
    setLoading(true);
    try {
      const data = await TransferService.getTransfers();
      setTransfers(data || []);
    } catch (error: any) {
      toast({
        title: 'Error loading transfers',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransfers();
  }, []);

  const handleApprove = async (id: string) => {
    try {
      const result = await TransferService.approveTransfer(id);
      if (result.success) {
        toast({ title: 'Transfer Completed', description: `Processed ${result.processed} items.` });
        loadTransfers();
      } else {
        toast({ title: 'Transfer Failed', description: result.message, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleReject = async (id: string) => {
    try {
      await TransferService.rejectTransfer(id, 'Rejected by admin'); // Simplified
      toast({ title: 'Transfer Rejected' });
      loadTransfers();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const pendingTransfers = transfers.filter(t => t.status === 'pending');
  const historyTransfers = transfers.filter(t => t.status !== 'pending');

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transfer Center</h1>
          <p className="text-muted-foreground">Manage entity transfers between tenants and franchises.</p>
        </div>
        <NewTransferDialog onSuccess={loadTransfers} />
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">Pending Approval ({pendingTransfers.length})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <TransferTable 
            transfers={pendingTransfers} 
            onApprove={handleApprove} 
            onReject={handleReject} 
            showActions 
          />
        </TabsContent>
        <TabsContent value="history">
          <TransferTable transfers={historyTransfers} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TransferTable({ transfers, onApprove, onReject, showActions }: { 
  transfers: any[], 
  onApprove?: (id: string) => void, 
  onReject?: (id: string) => void,
  showActions?: boolean 
}) {
  if (transfers.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          No transfers found.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            {showActions && <TableHead>Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {transfers.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="font-mono text-xs">{t.id.slice(0, 8)}</TableCell>
              <TableCell className="capitalize">{t.transfer_type.replace(/_/g, ' ')}</TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{t.source_tenant?.name}</span>
                  <span className="text-xs text-muted-foreground">{t.source_franchise?.name || 'Tenant Level'}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{t.target_tenant?.name}</span>
                  <span className="text-xs text-muted-foreground">{t.target_franchise?.name || 'Tenant Level'}</span>
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge status={t.status} />
              </TableCell>
              <TableCell>{new Date(t.created_at).toLocaleDateString()}</TableCell>
              {showActions && (
                <TableCell>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => onApprove?.(t.id)}>Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => onReject?.(t.id)}>Reject</Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: any = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    failed: 'bg-red-100 text-red-800',
  };
  
  return (
    <Badge variant="secondary" className={styles[status] || ''}>
      {status}
    </Badge>
  );
}

function NewTransferDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [targetTenantId, setTargetTenantId] = useState('');
  const [targetFranchiseId, setTargetFranchiseId] = useState('');
  const [transferType, setTransferType] = useState<any>('tenant_to_tenant');
  const [entityType, setEntityType] = useState<TransferEntityType>('lead');
  const [entityId, setEntityId] = useState('');
  const { toast } = useToast();
  const { context } = useCRM();

  const handleSubmit = async () => {
    try {
      if (!context?.tenantId) throw new Error('No source tenant context');

      await TransferService.createTransfer({
        source_tenant_id: context.tenantId,
        source_franchise_id: context.franchiseId || undefined,
        target_tenant_id: targetTenantId,
        target_franchise_id: transferType !== 'tenant_to_tenant' ? targetFranchiseId : undefined,
        transfer_type: transferType,
        items: [{ entity_type: entityType, entity_id: entityId }]
      });

      toast({ title: 'Transfer Requested' });
      setOpen(false);
      onSuccess();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New Transfer</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Initiate Transfer</DialogTitle>
          <DialogDescription>Move records to another tenant or franchise.</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Target Tenant ID</Label>
            <Input 
              placeholder="UUID of target tenant" 
              value={targetTenantId} 
              onChange={(e) => setTargetTenantId(e.target.value)} 
            />
            <p className="text-xs text-muted-foreground">Enter the destination tenant UUID.</p>
          </div>

          <div className="space-y-2">
             <Label>Entity Type</Label>
             <Select value={entityType} onValueChange={(v: any) => setEntityType(v)}>
               <SelectTrigger><SelectValue /></SelectTrigger>
               <SelectContent>
                 <SelectItem value="lead">Lead</SelectItem>
                 <SelectItem value="opportunity">Opportunity</SelectItem>
                 <SelectItem value="account">Account</SelectItem>
                 <SelectItem value="contact">Contact</SelectItem>
               </SelectContent>
             </Select>
          </div>

          <div className="space-y-2">
            <Label>Entity ID</Label>
            <Input 
              placeholder="UUID of record to transfer" 
              value={entityId} 
              onChange={(e) => setEntityId(e.target.value)} 
            />
          </div>

          <Button className="w-full" onClick={handleSubmit}>Create Request</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
