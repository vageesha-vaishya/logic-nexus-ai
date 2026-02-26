import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCRM } from '@/hooks/useCRM';
import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Quote, QuoteStatus, statusConfig } from '@/pages/dashboard/quotes-data';
import { FileText, Search, Plus, DollarSign, Calendar, Trash2 } from 'lucide-react';
import { QuoteMetrics } from '@/components/sales/QuoteMetrics';
import { DataTable, ColumnDef } from '@/components/system/DataTable';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { FirstScreenTemplate } from '@/components/system/FirstScreenTemplate';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useUndo } from '@/hooks/useUndo';

import { logger } from "@/lib/logger";
import { useDebug } from '@/hooks/useDebug';

export default function Quotes() {
  const navigate = useNavigate();
  const { scopedDb } = useCRM();
  const debug = useDebug('Sales', 'QuotesList');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const { filters, setFilters } = useUrlFilters({
    page: 1,
    pageSize: 10,
    sortField: 'created_at',
    sortDirection: 'desc' as 'asc' | 'desc',
    q: '',
    status: 'any',
  });

  const { performDeleteWithUndo } = useUndo();

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const from = (Number(filters.page) - 1) * Number(filters.pageSize);
      const to = from + Number(filters.pageSize) - 1;

      let query = scopedDb
        .from('quotes')
        .select(`
          *,
          sell_price:total,
          accounts:customer_id (id, name),
          contacts:contact_id (id, first_name, last_name),
          opportunities:opportunity_id (id, name),
          carriers:carrier_id (id, carrier_name)
        `, { count: 'exact' });

      if (filters.status !== 'any') {
        query = query.eq('status', filters.status);
      }

      if (filters.q) {
        query = query.or(`quote_number.ilike.%${filters.q}%,title.ilike.%${filters.q}%`);
      }

      query = query.order(String(filters.sortField), { ascending: filters.sortDirection === 'asc' });
      query = query.range(from, to);

      const { data, error, count } = await query;
      
      if (error) throw error;

      setQuotes(data || []);
      setTotalCount(count || 0);
    } catch (error: any) {
      toast.error('Failed to load quotes');
      logger.error('Failed to fetch quotes', { error: error.message });
    } finally {
      setLoading(false);
    }
  }, [scopedDb, filters.page, filters.pageSize, filters.sortField, filters.sortDirection, filters.q, filters.status]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  const columns: ColumnDef<Quote>[] = [
    { 
      key: 'quote_number', 
      header: 'Quote #', 
      className: 'font-mono font-medium',
      sortable: true
    },
    { 
      key: 'account', 
      header: 'Account', 
      render: (q) => q.accounts?.name || '-' 
    },
    { 
      key: 'sell_price', 
      header: 'Total Price', 
      render: (q) => q.sell_price ? `$${q.sell_price.toLocaleString()}` : '-',
      sortable: true
    },
    { 
      key: 'status', 
      header: 'Status', 
      render: (q) => {
        const config = statusConfig[q.status];
        return (
          <Badge className={config?.color}>
            {config?.label || q.status.toUpperCase()}
          </Badge>
        );
      },
      sortable: true
    },
    { 
      key: 'created_at', 
      header: 'Created', 
      render: (q) => format(new Date(q.created_at), 'MMM d, yyyy'),
      sortable: true
    },
    {
      key: 'actions',
      header: '',
      render: (q) => (
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={(e) => {
            e.stopPropagation();
            handleDelete(q.id);
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )
    }
  ];

  const handleDelete = async (id: string) => {
    const quoteToDelete = quotes.find(q => q.id === id);
    if (!quoteToDelete) return;

    await performDeleteWithUndo({
      table: 'quotes',
      data: quoteToDelete,
      label: 'Quote',
      onSuccess: () => fetchQuotes()
    });
  };

  return (
    <DashboardLayout>
      <FirstScreenTemplate
        title="Quotes"
        description="Manage sales quotes and opportunities."
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Quotes' }]}
        onCreate={() => navigate('/dashboard/quotes/new')}
      >
        <QuoteMetrics quotes={quotes} loading={loading} />
        
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              All Quotes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={quotes}
              columns={columns}
              isLoading={loading}
              onRowClick={(q) => navigate(`/dashboard/quotes/${q.id}`)}
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
                query: String(filters.q),
                onQueryChange: (q) => setFilters({ q, page: 1 }),
                placeholder: "Search quotes..."
              }}
              facets={[
                {
                  key: 'status',
                  label: 'Status',
                  value: String(filters.status),
                  onChange: (status) => setFilters({ status, page: 1 }),
                  options: Object.entries(statusConfig).map(([val, cfg]) => ({
                    label: cfg.label,
                    value: val
                  }))
                }
              ]}
              mobileTitleKey="quote_number"
              mobileSubtitleKey="account_id"
            />
          </CardContent>
        </Card>
      </FirstScreenTemplate>
    </DashboardLayout>
  );
}
