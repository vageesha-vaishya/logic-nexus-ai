
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCRM } from '@/hooks/useCRM';
import { FirstScreenTemplate } from '@/components/system/FirstScreenTemplate';
import { EmptyState } from '@/components/system/EmptyState';
import { InvoiceService } from '@/services/invoicing/InvoiceService';
import { Invoice } from '@/services/invoicing/types';
import { format } from 'date-fns';

export default function Invoices() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { scopedDb } = useCRM();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInvoices();
  }, [scopedDb]);

  const fetchInvoices = async () => {
    try {
      const data = await InvoiceService.listInvoices(scopedDb);
      setInvoices(data);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'default'; // primary
      case 'issued': return 'secondary';
      case 'draft': return 'outline';
      case 'overdue': return 'destructive';
      case 'void': return 'secondary';
      case 'cancelled': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <DashboardLayout>
      <FirstScreenTemplate
        title="Invoices"
        description="Manage customer invoices and billing."
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Invoices' }]}
        viewMode="list"
        availableModes={['list']}
        onCreate={() => navigate('/dashboard/finance/invoices/new')}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              All Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : invoices.length === 0 ? (
              <EmptyState
                title="No invoices found"
                description="Create your first invoice."
                actionLabel="New Invoice"
                onAction={() => navigate('/dashboard/finance/invoices/new')}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow
                      key={inv.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/dashboard/finance/invoices/${inv.id}`)}
                    >
                      <TableCell className="font-mono font-medium">{inv.invoice_number}</TableCell>
                      <TableCell>{inv.customer?.name || inv.customer_id || 'Unknown'}</TableCell>
                      <TableCell>{inv.issue_date ? format(new Date(inv.issue_date), 'MMM d, yyyy') : '-'}</TableCell>
                      <TableCell>{inv.due_date ? format(new Date(inv.due_date), 'MMM d, yyyy') : '-'}</TableCell>
                      <TableCell className="text-right font-medium">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: inv.currency }).format(inv.total)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(inv.status) as any}>
                          {inv.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </FirstScreenTemplate>
    </DashboardLayout>
  );
}
