
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCRM } from '@/hooks/useCRM';
import { FirstScreenTemplate } from '@/components/system/FirstScreenTemplate';
import { EmptyState } from '@/components/system/EmptyState';
import { InvoiceService } from '@/services/invoicing/InvoiceService';
import { Invoice } from '@/services/invoicing/types';
import { format } from 'date-fns';
import { DataTable, ColumnDef } from '@/components/system/DataTable';
import { useUrlFilters } from '@/hooks/useUrlFilters';

export default function Invoices() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { scopedDb } = useCRM();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const { filters, setFilters } = useUrlFilters({
    page: 1,
    pageSize: 10,
    sortField: 'created_at',
    sortDirection: 'desc' as 'asc' | 'desc',
    search: '',
  });

  useEffect(() => {
    fetchInvoices();
  }, [scopedDb, filters.page, filters.pageSize, filters.sortField, filters.sortDirection, filters.search]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const { data, totalCount } = await InvoiceService.listInvoices(scopedDb, {
        pageIndex: Number(filters.page),
        pageSize: Number(filters.pageSize),
        sortField: String(filters.sortField),
        sortDirection: filters.sortDirection as 'asc' | 'desc'
      });
      setInvoices(data);
      setTotalCount(totalCount);
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

  const columns: ColumnDef<Invoice>[] = [
    { 
      key: 'invoice_number', 
      header: 'Invoice #', 
      className: 'font-mono font-medium',
      sortable: true
    },
    { 
      key: 'customer', 
      header: 'Customer', 
      render: (inv) => inv.customer?.name || inv.customer_id || 'Unknown' 
    },
    { 
      key: 'issue_date', 
      header: 'Date', 
      render: (inv) => inv.issue_date ? format(new Date(inv.issue_date), 'MMM d, yyyy') : '-',
      sortable: true
    },
    { 
      key: 'due_date', 
      header: 'Due Date', 
      render: (inv) => inv.due_date ? format(new Date(inv.due_date), 'MMM d, yyyy') : '-',
      sortable: true
    },
    { 
      key: 'total', 
      header: 'Amount', 
      className: 'text-right font-medium',
      render: (inv) => new Intl.NumberFormat('en-US', { style: 'currency', currency: inv.currency || 'USD' }).format(inv.total || 0),
      sortable: true
    },
    { 
      key: 'status', 
      header: 'Status', 
      render: (inv) => (
        <Badge variant={getStatusColor(inv.status) as any}>
          {inv.status.toUpperCase()}
        </Badge>
      ),
      sortable: true
    },
  ];

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
            {invoices.length === 0 && !loading ? (
              <EmptyState
                title="No invoices found"
                description="Create your first invoice."
                actionLabel="New Invoice"
                onAction={() => navigate('/dashboard/finance/invoices/new')}
              />
            ) : (
              <DataTable
                data={invoices}
                columns={columns}
                isLoading={loading}
                onRowClick={(inv) => navigate(`/dashboard/finance/invoices/${inv.id}`)}
                pagination={{
                  pageIndex: Number(filters.page),
                  pageSize: Number(filters.pageSize),
                  totalCount,
                  onPageChange: (page) => setFilters({ page }),
                  onPageSizeChange: (pageSize) => setFilters({ pageSize, page: 1 })
                }}
                sorting={{
                  field: String(filters.sortField),
                  direction: filters.sortDirection as 'asc' | 'desc',
                  onSort: (field) => {
                    const direction = filters.sortField === field && filters.sortDirection === 'asc' ? 'desc' : 'asc';
                    setFilters({ sortField: field, sortDirection: direction });
                  }
                }}
                search={{
                  query: String(filters.search),
                  onQueryChange: (search) => setFilters({ search, page: 1 }),
                  placeholder: "Search invoices..."
                }}
                mobileTitleKey="invoice_number"
                mobileSubtitleKey="customer_id"
              />
            )}
          </CardContent>
        </Card>
      </FirstScreenTemplate>
    </DashboardLayout>
  );
}
