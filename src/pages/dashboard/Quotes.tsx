import { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '@/hooks/useCRM';
import { useDebug } from '@/hooks/useDebug';
import { Quote } from './quotes-data';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { FirstScreenTemplate } from '@/components/system/FirstScreenTemplate';
import { DataTable } from '@/components/system/DataTable';
import { ColumnDef } from '@/components/system/DataTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Trash2, FileText, Download, AlertCircle, RefreshCcw, ExternalLink, List, LayoutGrid } from 'lucide-react';
import { format } from 'date-fns';
import { statusConfig } from '@/config/statusConfig';
import { QuoteMetrics } from '@/components/sales/QuoteMetrics';
import { QuoteStatusChart } from '@/components/sales/QuoteStatusChart';
import { useUndo } from '@/hooks/useUndo';
import { toast } from 'sonner';
// fix: corrected logger import
import { logger } from '@/lib/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useUrlFilters, SortState } from '@/hooks/useUrlFilters';
import Papa from 'papaparse';
import { AdvancedSearchFilter, FilterCriterion } from '@/components/sales/AdvancedSearchFilter';

interface QuoteWithRelations extends Quote {
  accounts?: { id: string; name: string };
  contacts?: { id: string; first_name: string; last_name: string };
  opportunities?: { id: string; name: string };
  carriers?: { id: string; carrier_name: string };
}

// Helper to handle multi-column sorting
const calculateNewSorts = (currentSorts: SortState[], field: string, multi: boolean): SortState[] => {
  const existing = currentSorts.find(s => s.field === field);
  let nextDirection: 'asc' | 'desc' | undefined = 'asc';
  
  if (existing?.direction === 'asc') nextDirection = 'desc';
  else if (existing?.direction === 'desc') nextDirection = undefined;

  if (!multi) {
    return nextDirection ? [{ field, direction: nextDirection }] : [];
  }

  const others = currentSorts.filter(s => s.field !== field);
  return nextDirection ? [...others, { field, direction: nextDirection }] : others;
};

export default function Quotes() {
  const navigate = useNavigate();
  const { scopedDb, supabase } = useCRM();
  const debug = useDebug('Sales', 'QuotesList');
  const [quotes, setQuotes] = useState<QuoteWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [error, setError] = useState<Error | null>(null);

  // Advanced Filters State
  const [activeFilters, setActiveFilters] = useState<FilterCriterion[]>([]);
  const [matchMode, setMatchMode] = useState<'all' | 'any'>('all');

  const { filters, setFilters } = useUrlFilters({
    page: 1,
    pageSize: 10,
    sorts: JSON.stringify([{ field: 'created_at', direction: 'desc' }]),
    q: '',
    status: 'any',
  }, 'quotes-list-filters-v2');

  const activeSorts: SortState[] = useMemo(() => {
    try {
      return JSON.parse(filters.sorts || '[]');
    } catch {
      return [];
    }
  }, [filters.sorts]);

  const fetchQuotes = useCallback(async () => {
    // Only show loading on initial fetch or filter change, not background refresh
    if (quotes.length === 0) setLoading(true);
    setError(null);
    try {
      const from = (Number(filters.page) - 1) * Number(filters.pageSize);
      const to = from + Number(filters.pageSize) - 1;

      // Determine if we need !inner join for account filtering
      const hasAccountFilter = activeFilters.some(f => f.field === 'account_name');

      let query = scopedDb
        .from('quotes')
        .select(`
          *,
          accounts:account_id${hasAccountFilter ? '!inner' : ''} (id, name),
          contacts:contact_id (id, first_name, last_name),
          opportunities:opportunity_id (id, name)
        `, { count: 'exact' });

      // Apply standard status filter
      if (filters.status !== 'any') {
        query = query.eq('status', filters.status);
      }

      // Apply search query (quote # or title)
      if (filters.q) {
        query = query.or(`quote_number.ilike.%${filters.q}%,title.ilike.%${filters.q}%`);
      }

      // Apply Advanced Filters
      if (activeFilters.length > 0) {
        activeFilters.forEach(filter => {
          const { field, operator, value } = filter;
          if (!value) return;

          let dbField = field;
          if (field === 'account_name') dbField = 'accounts.name';
          
          switch (operator) {
            case 'equals':
              query = query.eq(dbField, value);
              break;
            case 'contains':
              query = query.ilike(dbField, `%${value}%`);
              break;
            case 'starts_with':
              query = query.ilike(dbField, `${value}%`);
              break;
            case 'gt':
              query = query.gt(dbField, value);
              break;
            case 'lt':
              query = query.lt(dbField, value);
              break;
          }
        });
      }

      if (activeSorts.length > 0) {
        activeSorts.forEach((s) => {
          query = query.order(s.field, { ascending: s.direction === 'asc' });
        });
      } else {
        query = query.order('created_at', { ascending: false });
      }
      query = query.range(from, to);

      const { data, error, count } = await query;
      
      if (error) throw error;

      // Manual Carrier Join (Schema Cache Workaround)
      // The schema cache might be missing the foreign key relationship for carriers:carrier_id
      // so we fetch carriers manually and map them.
      let quotesData = (data || []) as QuoteWithRelations[];
      const carrierIds = [...new Set(quotesData.map((q: any) => q.carrier_id).filter(Boolean))];
      
      if (carrierIds.length > 0) {
        const { data: carriers, error: carrierError } = await scopedDb
          .from('carriers')
          .select('id, carrier_name')
          .in('id', carrierIds);
          
        if (!carrierError && carriers) {
          const carrierMap = new Map(carriers.map((c: any) => [c.id, c]));
          quotesData = quotesData.map(q => ({
            ...q,
            carriers: (q as any).carrier_id ? carrierMap.get((q as any).carrier_id) : undefined
          }));
        } else if (carrierError) {
          console.warn('Failed to fetch carriers manually:', carrierError);
        }
      }

      setQuotes(quotesData);
      setTotalCount(count || 0);
    } catch (error: any) {
      console.error('Failed to fetch quotes:', error);
      setError(error);
      toast.error('Failed to load quotes');
    } finally {
      setLoading(false);
    }
  }, [scopedDb, filters.page, filters.pageSize, activeSorts, filters.q, filters.status, activeFilters]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // CMD/CTRL + B = New Quote
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        navigate('/dashboard/quotes/new');
      }
      // CMD/CTRL + R = Refresh
      if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
        e.preventDefault();
        fetchQuotes();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fetchQuotes, navigate]);

  const { performDeleteWithUndo } = useUndo();

  // Handle Advanced Filter Apply
  const handleFilterApply = (newFilters: FilterCriterion[], mode: 'all' | 'any') => {
    setActiveFilters(newFilters);
    setMatchMode(mode);
    setFilters({ page: 1 }); // Reset to first page
  };

  const handleRemoveFilter = (id: string) => {
    setActiveFilters(prev => prev.filter(f => f.id !== id));
    setFilters({ page: 1 });
  };

  // Real-time subscription
  useEffect(() => {
    fetchQuotes();

    const channel = supabase
      .channel('quotes-list-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quotes',
        },
        () => {
          logger.info('Real-time update detected, refreshing quotes list...');
          fetchQuotes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchQuotes, supabase]);

  const handleDuplicate = async (id: string) => {
    try {
      toast.loading('Preparing to duplicate...');
      // Fetch full quote details
      const { data: fullQuote, error } = await scopedDb
        .from('quotes')
        .select(`
          *,
          origin_location:origin_port_id(location_name),
          destination_location:destination_port_id(location_name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Navigate to composer with data
      navigate('/dashboard/quotes/new', { 
        state: { 
          initialData: {
            accountId: fullQuote.account_id,
            contactId: fullQuote.contact_id,
            quoteTitle: `${fullQuote.title} (Copy)`,
            mode: fullQuote.transport_mode || 'ocean',
            origin: fullQuote.origin_location?.location_name || fullQuote.origin,
            destination: fullQuote.destination_location?.location_name || fullQuote.destination,
            // Add other fields as needed
          }
        } 
      });
      toast.dismiss();
    } catch (err) {
      toast.error('Failed to duplicate quote');
      logger.error('Duplicate failed', err);
    }
  };

  const handleExport = useCallback(() => {
    try {
      if (quotes.length === 0) {
        toast.info('No quotes to export');
        return;
      }

      const exportData = quotes.map(q => ({
        'Quote Number': q.quote_number,
        'Title': q.title,
        'Status': q.status,
        'Account': q.accounts?.name || '',
        'Contact': q.contacts ? `${q.contacts.first_name} ${q.contacts.last_name}` : '',
        'Opportunity': q.opportunities?.name || '',
        'Carrier': q.carriers?.carrier_name || '',
        'Total Price': q.sell_price || 0,
        'Created At': format(new Date(q.created_at), 'yyyy-MM-dd HH:mm:ss'),
        'Updated At': q.updated_at ? format(new Date(q.updated_at), 'yyyy-MM-dd HH:mm:ss') : ''
      }));

      const csv = Papa.unparse(exportData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `quotes_export_${format(new Date(), 'yyyy-MM-dd_HHmm')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Export failed', err);
      toast.error('Failed to export quotes');
    }
  }, [quotes]);

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
      key: 'opportunity', 
      header: 'Opportunity', 
      render: (q) => q.opportunities ? (
        <Button 
          variant="link" 
          className="p-0 h-auto font-normal text-primary hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/dashboard/opportunities/${q.opportunity_id}`);
          }}
        >
          {q.opportunities.name}
        </Button>
      ) : '-' 
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
      key: 'updated_at', 
      header: 'Last Modified', 
      render: (q) => q.updated_at ? format(new Date(q.updated_at), 'MMM d, yyyy') : '-',
      sortable: true
    },
    {
      key: 'actions',
      header: '',
      render: (q) => (
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            title="Duplicate Quote"
            onClick={(e) => {
              e.stopPropagation();
              handleDuplicate(q.id);
            }}
          >
            <Copy className="h-4 w-4" />
          </Button>
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
        </div>
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
        description="Manage sales quotes and opportunities. Shortcuts: ⌘/Ctrl+B (New), ⌘/Ctrl+R (Refresh)"
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Quotes' }]}
        onCreate={() => navigate('/dashboard/quotes/new')}
      >
        <div className="space-y-6 mb-8">
          <QuoteMetrics quotes={quotes} loading={loading} />
          {!loading && !error && quotes.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <QuoteStatusChart quotes={quotes} />
            </div>
          )}
        </div>
        
        <div className="flex justify-end mb-4">
          <AdvancedSearchFilter 
            activeFilters={activeFilters}
            onFilterApply={handleFilterApply}
            onRemoveFilter={handleRemoveFilter}
          />
        </div>

        {error && (
          <Alert variant="destructive" className="mt-6 mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error loading quotes</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>{error.message || "An unexpected error occurred while fetching quotes."}</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchQuotes}
                className="ml-4 bg-background text-foreground hover:bg-accent"
              >
                <RefreshCcw className="mr-2 h-3 w-3" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Card className={!error ? "mt-6" : ""}>
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
              multiSort={{
                sorts: activeSorts,
                onSort: (field, multi) => {
                  setFilters({
                    sorts: JSON.stringify(calculateNewSorts(activeSorts, field, multi))
                  });
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
              actions={
                <div className="flex items-center gap-1 border rounded-md p-0.5 bg-muted/50">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleExport}
                    title="Export to CSV"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setViewMode('table')}
                    title="List View"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setViewMode('grid')}
                    title="Grid View"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </div>
              }
              viewMode={viewMode}
              mobileTitleKey="quote_number"
              mobileSubtitleKey="account_id"
            />
          </CardContent>
        </Card>
      </FirstScreenTemplate>
    </DashboardLayout>
  );
}
