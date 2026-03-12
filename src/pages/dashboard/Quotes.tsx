import { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
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
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import Papa from 'papaparse';
import { AdvancedSearchFilter, FilterCriterion } from '@/components/sales/AdvancedSearchFilter';
import { FEATURE_FLAGS, useAppFeatureFlag } from '@/lib/feature-flags';
import { QuotationDeleteService } from '@/services/quotation/QuotationDeleteService';

interface QuoteWithRelations extends Quote {
  accounts?: { id: string; name: string };
  contacts?: { id: string; first_name: string; last_name: string };
  opportunities?: { id: string; name: string };
  carriers?: { id: string; carrier_name: string };
}

type SortState = {
  field: string;
  direction: 'asc' | 'desc';
};

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

const RETRY_DELAYS_MS = [0, 500, 1200];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error || '').toLowerCase();
  return (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('temporar') ||
    message.includes('connection') ||
    message.includes('socket') ||
    message.includes('failed to load')
  );
};

export default function Quotes() {
  const navigate = useNavigate();
  const { scopedDb, supabase } = useCRM();
  const { hasPermission } = useAuth();
  const { enabled: quoteImportExportEnabled } = useAppFeatureFlag(FEATURE_FLAGS.QUOTATION_IMPORT_EXPORT_V2, true);
  const canUseQuoteImportExport = quoteImportExportEnabled && (hasPermission('quotes.import_export') || hasPermission('import_quotation') || hasPermission('export_quotation'));
  const [quotes, setQuotes] = useState<QuoteWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [error, setError] = useState<Error | null>(null);
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<string[]>([]);
  const [deleteInProgress, setDeleteInProgress] = useState(false);

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
    if (quotes.length === 0) setLoading(true);
    setError(null);

    const fetchQuotesAttempt = async (attempt: number) => {
      const from = (Number(filters.page) - 1) * Number(filters.pageSize);
      const to = from + Number(filters.pageSize) - 1;
      const sortableQuoteFields = new Set(['quote_number', 'sell_price', 'status', 'created_at', 'updated_at', 'title']);
      const safeSorts = activeSorts.filter((s) => sortableQuoteFields.has(s.field));

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

      if (safeSorts.length > 0) {
        safeSorts.forEach((s) => {
          query = query.order(s.field, { ascending: s.direction === 'asc' });
        });
      } else {
        query = query.order('created_at', { ascending: false });
      }
      query = query.range(from, to);

      let data: any[] | null = null;
      let count: number | null = 0;

      const primaryResult = await query;
      if (primaryResult.error) {
        logger.warn('Primary quotes query with relations failed; using fallback query', {
          attempt,
          error: primaryResult.error,
        });

        let fallbackQuery = scopedDb
          .from('quotes')
          .select('*', { count: 'exact' });

        if (filters.status !== 'any') {
          fallbackQuery = fallbackQuery.eq('status', filters.status);
        }

        if (filters.q) {
          fallbackQuery = fallbackQuery.or(`quote_number.ilike.%${filters.q}%,title.ilike.%${filters.q}%`);
        }

        // Apply filters that can be evaluated directly on quotes.
        const nonAccountFilters = activeFilters.filter((f) => f.field !== 'account_name');
        nonAccountFilters.forEach((filter) => {
          const { field, operator, value } = filter;
          if (!value) return;
          switch (operator) {
            case 'equals':
              fallbackQuery = fallbackQuery.eq(field, value);
              break;
            case 'contains':
              fallbackQuery = fallbackQuery.ilike(field, `%${value}%`);
              break;
            case 'starts_with':
              fallbackQuery = fallbackQuery.ilike(field, `${value}%`);
              break;
            case 'gt':
              fallbackQuery = fallbackQuery.gt(field, value);
              break;
            case 'lt':
              fallbackQuery = fallbackQuery.lt(field, value);
              break;
          }
        });

        // Account name filter fallback: resolve matching account IDs first.
        const accountNameFilter = activeFilters.find((f) => f.field === 'account_name' && f.value);
        if (accountNameFilter) {
          let accountsQuery = scopedDb.from('accounts').select('id');
          switch (accountNameFilter.operator) {
            case 'equals':
              accountsQuery = accountsQuery.eq('name', accountNameFilter.value);
              break;
            case 'starts_with':
              accountsQuery = accountsQuery.ilike('name', `${accountNameFilter.value}%`);
              break;
            case 'contains':
            default:
              accountsQuery = accountsQuery.ilike('name', `%${accountNameFilter.value}%`);
              break;
          }
          const { data: accountRows, error: accountFilterError } = await accountsQuery;
          if (accountFilterError) {
            throw accountFilterError;
          }
          const accountIds = (accountRows || []).map((a: any) => a.id);
          if (accountIds.length === 0) {
            setQuotes([]);
            setTotalCount(0);
            return;
          }
          fallbackQuery = fallbackQuery.in('account_id', accountIds);
        }

        if (safeSorts.length > 0) {
          safeSorts.forEach((s) => {
            fallbackQuery = fallbackQuery.order(s.field, { ascending: s.direction === 'asc' });
          });
        } else {
          fallbackQuery = fallbackQuery.order('created_at', { ascending: false });
        }
        fallbackQuery = fallbackQuery.range(from, to);

        const fallbackResult = await fallbackQuery;
        if (fallbackResult.error) {
          throw fallbackResult.error;
        }
        data = fallbackResult.data || [];
        count = fallbackResult.count || 0;
      } else {
        data = primaryResult.data || [];
        count = primaryResult.count || 0;
      }

      // Manual Carrier Join (Schema Cache Workaround)
      // The schema cache might be missing the foreign key relationship for carriers:carrier_id
      // so we fetch carriers manually and map them.
      let quotesData = (data || []) as QuoteWithRelations[];
      const carrierIds = [...new Set(quotesData.map((q: any) => q.carrier_id).filter(Boolean))] as string[];
      const accountIds = [...new Set(quotesData.map((q: any) => q.account_id).filter(Boolean))] as string[];
      const contactIds = [...new Set(quotesData.map((q: any) => q.contact_id).filter(Boolean))] as string[];
      const opportunityIds = [...new Set(quotesData.map((q: any) => q.opportunity_id).filter(Boolean))] as string[];

      const [carriersRes, accountsRes, contactsRes, opportunitiesRes] = await Promise.all([
        carrierIds.length > 0
          ? scopedDb.from('carriers').select('id, carrier_name').in('id', carrierIds)
          : Promise.resolve({ data: [], error: null } as any),
        accountIds.length > 0
          ? scopedDb.from('accounts').select('id, name').in('id', accountIds)
          : Promise.resolve({ data: [], error: null } as any),
        contactIds.length > 0
          ? scopedDb.from('contacts').select('id, first_name, last_name').in('id', contactIds)
          : Promise.resolve({ data: [], error: null } as any),
        opportunityIds.length > 0
          ? scopedDb.from('opportunities').select('id, name').in('id', opportunityIds)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      if (carriersRes.error) {
        logger.warn('Failed to fetch carriers manually', carriersRes.error);
      }
      if (accountsRes.error) {
        logger.warn('Failed to fetch accounts manually', accountsRes.error);
      }
      if (contactsRes.error) {
        logger.warn('Failed to fetch contacts manually', contactsRes.error);
      }
      if (opportunitiesRes.error) {
        logger.warn('Failed to fetch opportunities manually', opportunitiesRes.error);
      }

      const carrierMap = new Map((carriersRes.data || []).map((c: any) => [c.id, c]));
      const accountMap = new Map((accountsRes.data || []).map((a: any) => [a.id, a]));
      const contactMap = new Map((contactsRes.data || []).map((c: any) => [c.id, c]));
      const opportunityMap = new Map((opportunitiesRes.data || []).map((o: any) => [o.id, o]));

      quotesData = quotesData.map((q: any) => ({
        ...q,
        carriers: q.carrier_id ? carrierMap.get(q.carrier_id) : q.carriers,
        accounts: q.account_id ? accountMap.get(q.account_id) : q.accounts,
        contacts: q.contact_id ? contactMap.get(q.contact_id) : q.contacts,
        opportunities: q.opportunity_id ? opportunityMap.get(q.opportunity_id) : q.opportunities,
      }));

      setQuotes(quotesData);
      setTotalCount(count || 0);
    };

    let lastError: unknown = null;

    for (let i = 0; i < RETRY_DELAYS_MS.length; i += 1) {
      const attempt = i + 1;
      try {
        await fetchQuotesAttempt(attempt);
        setLoading(false);
        return;
      } catch (error: any) {
        logger.error('Quotes fetch attempt failed', {
          attempt,
          maxAttempts: RETRY_DELAYS_MS.length,
          error: error?.message || String(error),
        });
        lastError = error;
        const shouldRetry = i < RETRY_DELAYS_MS.length - 1 && isRetryableError(error);
        if (shouldRetry) {
          await delay(RETRY_DELAYS_MS[i + 1]);
          continue;
        }
      }
    }

    try {
      const from = (Number(filters.page) - 1) * Number(filters.pageSize);
      const to = from + Number(filters.pageSize) - 1;

      let minimalQuery = scopedDb
        .from('quotes')
        .select('id, quote_number, title, status, created_at, updated_at, sell_price, account_id, contact_id, opportunity_id, carrier_id', { count: 'exact' });

      if (filters.status !== 'any') {
        minimalQuery = minimalQuery.eq('status', filters.status);
      }
      if (filters.q) {
        minimalQuery = minimalQuery.or(`quote_number.ilike.%${filters.q}%,title.ilike.%${filters.q}%`);
      }

      minimalQuery = minimalQuery.order('created_at', { ascending: false }).range(from, to);
      const minimalRes = await minimalQuery;
      if (minimalRes.error) throw minimalRes.error;

      setQuotes((minimalRes.data || []) as QuoteWithRelations[]);
      setTotalCount(minimalRes.count || 0);
      setError(null);
      toast.error('Loaded quotes in compatibility mode');
      logger.warn('Quotes loaded in compatibility mode after retries failed', {
        error: lastError instanceof Error ? lastError.message : String(lastError || ''),
      });
    } catch (minimalError: any) {
      const finalError = minimalError instanceof Error ? minimalError : new Error(minimalError?.message || 'Failed to load quotes');
      setError(finalError);
      logger.error('Quotes fetch failed in compatibility mode', {
        error: finalError.message,
        rootError: lastError instanceof Error ? lastError.message : String(lastError || ''),
      });
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

  const quotationDeleteService = useMemo(() => new QuotationDeleteService(scopedDb), [scopedDb]);

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

  const handleDeleteQuotes = useCallback(
    async (quoteIds: string[], reason?: string) => {
      if (quoteIds.length === 0) return;
      if (!hasPermission('quotes.delete')) {
        toast.error('You do not have permission to delete quotes');
        return;
      }

      const confirmationMessage =
        quoteIds.length === 1
          ? 'Delete this quote?'
          : `Delete ${quoteIds.length} selected quotes?`;

      if (!window.confirm(confirmationMessage)) return;

      try {
        setDeleteInProgress(true);
        const report = await quotationDeleteService.deleteQuotes(quoteIds, reason, {
          atomic: true,
          forceHardDelete: false,
        });

        if (report.ok) {
          const { hard_deleted, soft_deleted } = report.summary;
          const deletedCount = hard_deleted + soft_deleted;
          toast.success(
            `Processed ${deletedCount} quote${deletedCount === 1 ? '' : 's'} (${hard_deleted} hard, ${soft_deleted} soft)`,
          );
        } else {
          const firstFailure = report.results.find((r) => !r.success);
          const message = firstFailure?.error || report.message || 'Some quotes failed to delete';
          toast.error(message);
        }

        setSelectedQuoteIds([]);
        await fetchQuotes();
      } catch (err: any) {
        logger.error('Quote deletion failed', err);
        toast.error(err?.message || 'Failed to delete quotes');
      } finally {
        setDeleteInProgress(false);
      }
    },
    [fetchQuotes, hasPermission, quotationDeleteService],
  );

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
            disabled={!hasPermission('quotes.delete') || deleteInProgress}
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
    const quoteToDelete = quotes.find((q) => q.id === id);
    if (!quoteToDelete) return;
    await handleDeleteQuotes([id], `Deleted quote ${quoteToDelete.quote_number}`);
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
              selection={{
                selectedIds: selectedQuoteIds,
                onSelectionChange: setSelectedQuoteIds,
                rowId: (row) => String(row.id),
              }}
              actions={
                <div className="flex items-center gap-1 border rounded-md p-0.5 bg-muted/50">
                  {canUseQuoteImportExport && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => navigate(`/dashboard/quotes/import-export?scope=selected&ids=${encodeURIComponent(selectedQuoteIds.join(','))}`)}
                        title="Export Selected"
                        disabled={selectedQuoteIds.length === 0}
                      >
                        Export Selected ({selectedQuoteIds.length})
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => navigate('/dashboard/quotes/import-export?scope=filtered')}
                        title="Export All Filtered"
                      >
                        Export All Filtered
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => navigate('/dashboard/quotes/import-export?mode=import')}
                        title="Import Quotations"
                      >
                        Import Quotations
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-destructive disabled:text-muted-foreground"
                    onClick={() => handleDeleteQuotes(selectedQuoteIds, 'Bulk delete from quote list')}
                    disabled={selectedQuoteIds.length === 0 || !hasPermission('quotes.delete') || deleteInProgress}
                    title="Delete Selected"
                  >
                    Delete Selected ({selectedQuoteIds.length})
                  </Button>
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
