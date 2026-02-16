import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHeader, TableRow, SortableHead } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext, PaginationFirst, PaginationLast } from '@/components/ui/pagination';
import { useSort } from '@/hooks/useSort';
import { usePagination } from '@/hooks/usePagination';
import { useCRM } from '@/hooks/useCRM';
import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Skeleton } from '@/components/ui/skeleton';
import { ViewToggle, ViewMode } from '@/components/ui/view-toggle';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Quote } from '@/pages/dashboard/quotes-data';
import { FileText, XCircle, Search, Filter, ArrowUpRight, Eye, Pencil, Trash2, MoreHorizontal, Plus, Sparkles } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { QuoteMetrics } from '@/components/sales/QuoteMetrics';
import { QuickQuoteModal } from '@/components/sales/quick-quote/QuickQuoteModal';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { logger } from "@/lib/logger";
import { useDebug } from '@/hooks/useDebug';

export default function Quotes() {
  const navigate = useNavigate();
  const { supabase, scopedDb } = useCRM();
  const debug = useDebug('Sales', 'QuotesList');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Filters state and helpers
  type TextOp = 'contains' | 'startsWith' | 'equals' | 'endsWith';

  const [quoteNumberQuery, setQuoteNumberQuery] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [contactQuery, setContactQuery] = useState('');
  const [opportunityQuery, setOpportunityQuery] = useState('');
  const [carrierQuery, setCarrierQuery] = useState('');

  const [quoteStatus, setQuoteStatus] = useState<string>('any');

  const [minSellPrice, setMinSellPrice] = useState<string>('');
  const [maxSellPrice, setMaxSellPrice] = useState<string>('');
  const [minMargin, setMinMargin] = useState<string>('');

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const fetchQuotes = useCallback(async () => {
    const startTime = performance.now();
    try {
      debug.info('Fetching quotes list', { 
        filters: { 
          status: quoteStatus, 
          customer: customerQuery, 
          dateRange: { start: startDate, end: endDate } 
        } 
      });

      // Fetch quotes with increased limit to include historical drafts
      // TODO: Implement server-side pagination for true scalability
      const { data, error } = await scopedDb
        .from('quotes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);
      
      if (error) throw error;

      const quotesData = (data || []) as any[];
      
      // Batch fetch related data to avoid N+1 problem
      const accountIds = [...new Set(quotesData.map(q => q.account_id).filter(Boolean))];
      const contactIds = [...new Set(quotesData.map(q => q.contact_id).filter(Boolean))];
      const opportunityIds = [...new Set(quotesData.map(q => q.opportunity_id).filter(Boolean))];
      const carrierIds = [...new Set(quotesData.map(q => q.carrier_id).filter(Boolean))];
      const serviceTypeIds = [...new Set(quotesData.map(q => q.service_type_id).filter(Boolean))];

      const [accountsRes, contactsRes, opportunitiesRes, carriersRes, serviceTypesRes] = await Promise.all([
        accountIds.length > 0 ? scopedDb.from('accounts').select('id, name').in('id', accountIds) : { data: [] },
        contactIds.length > 0 ? scopedDb.from('contacts').select('id, first_name, last_name').in('id', contactIds) : { data: [] },
        opportunityIds.length > 0 ? scopedDb.from('opportunities').select('id, name').in('id', opportunityIds) : { data: [] },
        carrierIds.length > 0 ? scopedDb.from('carriers').select('id, carrier_name').in('id', carrierIds) : { data: [] },
        serviceTypeIds.length > 0 ? scopedDb.from('service_types').select('id, name').in('id', serviceTypeIds) : { data: [] },
      ]);

      // Create lookup maps
      const accountMap = new Map(accountsRes.data?.map((a: any) => [a.id, a]) || []);
      const contactMap = new Map(contactsRes.data?.map((c: any) => [c.id, c]) || []);
      const opportunityMap = new Map(opportunitiesRes.data?.map((o: any) => [o.id, o]) || []);
      const carrierMap = new Map(carriersRes.data?.map((c: any) => [c.id, c]) || []);
      const serviceTypeMap = new Map(serviceTypesRes.data?.map((s: any) => [s.id, s]) || []);

      // Map relations to quotes
      const quotesWithRelations = quotesData.map(quote => ({
        ...quote,
        accounts: quote.account_id ? accountMap.get(quote.account_id) : null,
        contacts: quote.contact_id ? contactMap.get(quote.contact_id) : null,
        opportunities: quote.opportunity_id ? opportunityMap.get(quote.opportunity_id) : null,
        carriers: quote.carrier_id ? carrierMap.get(quote.carrier_id) : null,
        service_types: quote.service_type_id ? serviceTypeMap.get(quote.service_type_id) : null,
      }));

      setQuotes(quotesWithRelations as unknown as Quote[]);
      
      const duration = performance.now() - startTime;
      debug.info('Quotes loaded successfully', { 
        count: quotesWithRelations.length,
        duration: `${duration.toFixed(2)}ms`
      });
    } catch (err: any) {
      const duration = performance.now() - startTime;
      debug.error('Failed to load quotes', {
        error: err.message,
        stack: err.stack,
        details: err.details || err.hint,
        duration: `${duration.toFixed(2)}ms`
      });
      // Fallback to system logger
      logger.error('Failed to load quotes', {
        error: err.message,
        stack: err.stack,
        details: err.details || err.hint,
        component: 'QuotesList'
      });
      const description = err instanceof Error ? err.message : String(err);
      toast.error('Failed to load quotes', { description });
    } finally {
      setLoading(false);
    }
  }, [scopedDb, quoteStatus, customerQuery, startDate, endDate]); // Added dependencies

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

  const statusVariant = (status?: string) => {
    switch ((status || '').toLowerCase()) {
      case 'accepted': return 'success';
      case 'sent': return 'secondary';
      case 'rejected': return 'destructive';
      case 'draft': return 'outline';
      default: return 'outline';
    }
  };

  const matchText = (value: string | undefined | null, query: string, op: TextOp) => {
    if (!query) return true;
    const v = (value || '').toLowerCase();
    const q = query.toLowerCase();
    switch (op) {
      case 'contains': return v.includes(q);
      case 'startsWith': return v.startsWith(q);
      case 'equals': return v === q;
      case 'endsWith': return v.endsWith(q);
      default: return true;
    }
  };

  const filteredQuotes = quotes.filter((q) => {
    const quoteNum = q.quote_number || (q.id ? String(q.id).slice(0, 8) : '');
    const matchesQuoteNum = matchText(quoteNum, quoteNumberQuery, 'contains');
    const customerName = (q as any).account?.name || '';
    const matchesCustomer = matchText(customerName, customerQuery, 'contains');
    const contactName = (q as any).contact ? `${(q as any).contact.first_name} ${(q as any).contact.last_name}` : '';
    const matchesContact = matchText(contactName, contactQuery, 'contains');
    const opportunityName = (q as any).opportunity?.name || '';
    const matchesOpportunity = matchText(opportunityName, opportunityQuery, 'contains');
    const carrierName = (q as any).carrier?.carrier_name || '';
    const matchesCarrier = matchText(carrierName, carrierQuery, 'contains');
    const statusVal = (q.status || '').toLowerCase();
    const matchesStatus = quoteStatus && quoteStatus !== 'any' ? statusVal === quoteStatus.toLowerCase() : true;
    const sell = Number(q.sell_price ?? 0);
    const matchesMinSell = minSellPrice ? sell >= Number(minSellPrice) : true;
    const matchesMaxSell = maxSellPrice ? sell <= Number(maxSellPrice) : true;
    const margin = (q.sell_price != null && q.cost_price != null) ? Number(q.sell_price) - Number(q.cost_price) : null;
    const matchesMinMargin = minMargin ? (margin != null ? margin >= Number(minMargin) : false) : true;
    const created = q.created_at ? new Date(q.created_at) : null;
    const startOk = startDate ? (created ? created >= new Date(startDate) : false) : true;
    const endOk = endDate ? (created ? created <= new Date(endDate) : false) : true;

    return (
      matchesQuoteNum && matchesCustomer && matchesContact && matchesOpportunity && matchesCarrier && matchesStatus && matchesMinSell && matchesMaxSell && matchesMinMargin && startOk && endOk
    );
  });

  const { sorted: sortedQuotes, sortField, sortDirection, onSort } = useSort<any>(
    filteredQuotes,
    {
      initialField: 'created_at',
      initialDirection: 'desc',
      accessors: {
        quote_number: (q: any) => q.quote_number || (q.id ? String(q.id).slice(0, 8) : ''),
        customer: (q: any) => q.account?.name || '',
        contact: (q: any) => (q.contact ? `${q.contact.first_name} ${q.contact.last_name}` : ''),
        opportunity: (q: any) => q.opportunity?.name || '',
        carrier: (q: any) => q.carrier?.carrier_name || '',
        status: (q: any) => q.status || '',
        sell_price: (q: any) => Number(q.sell_price ?? 0),
        margin: (q: any) => (q.sell_price != null && q.cost_price != null ? Number(q.sell_price) - Number(q.cost_price) : 0),
        created_at: (q: any) => (q.created_at ? new Date(q.created_at).getTime() : 0),
      },
    }
  );

  const {
    pageItems: pagedQuotes,
    pageSize,
    setPageSize,
    pageSizeOptions,
    currentPage,
    totalPages,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    canPrev,
    canNext,
  } = usePagination(sortedQuotes, { initialPageSize: 20 });

  const deleteQuotes = async (quoteIds: string[]) => {
    if (!quoteIds.length) return;
    setLoading(true);
    const startTime = performance.now();
    debug.info('Starting quote deletion', { count: quoteIds.length, quoteIds });

    try {
      // Use RPC for cascade delete to handle all dependent tables
      const { error } = await supabase.rpc('delete_quotes_cascade', {
        quote_ids: quoteIds
      });

      if (error) throw error;

      const duration = performance.now() - startTime;
      debug.info('Quote deletion successful', { 
        count: quoteIds.length, 
        quoteIds,
        duration: `${duration.toFixed(2)}ms` 
      });

      toast.success(`Successfully deleted ${quoteIds.length} quote(s)`);
      fetchQuotes();
    } catch (err: any) {
        // Fallback: perform scoped cascading deletes if RPC is unavailable or blocked
        try {
          debug.warn('RPC delete failed, attempting client-side cascade', { error: err?.message });
          // 1) Unlink opportunities
          await scopedDb
            .from('opportunities')
            .update({ primary_quote_id: null })
            .in('primary_quote_id', quoteIds);
          
          // 2) Resolve versions and options
          const { data: versions = [] } = await scopedDb
            .from('quotation_versions')
            .select('id')
            .in('quote_id', quoteIds);
          const versionIds = (versions as any[]).map(v => String(v.id));
          
          let optionIds: string[] = [];
          if (versionIds.length) {
            const { data: options = [] } = await scopedDb
              .from('quotation_version_options')
              .select('id')
              .in('quotation_version_id', versionIds);
            const isUUID = (v: any) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
            optionIds = (options as any[]).map(o => String(o.id)).filter(isUUID);
          }
          
          // 3) Delete charges
          if (optionIds.length) {
            await scopedDb.from('quote_charges').delete().in('quote_option_id', optionIds);
          }
          // 4) Delete legs
          if (optionIds.length) {
            await scopedDb.from('quotation_version_option_legs').delete().in('quotation_version_option_id', optionIds);
            await scopedDb.from('quote_legs').delete().in('quote_option_id', optionIds);
          }
          // 5) Delete options and versions
          if (optionIds.length) {
            await scopedDb.from('quotation_version_options').delete().in('id', optionIds);
          }
          if (versionIds.length) {
            await scopedDb.from('quotation_versions').delete().in('id', versionIds);
          }
          // 6) Delete quotes
          const isUUID = (v: any) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
          const validQuoteIds = quoteIds.filter(isUUID);
          if (validQuoteIds.length) {
            await scopedDb.from('quotes').delete().in('id', validQuoteIds);
          }

          const duration = performance.now() - startTime;
          debug.info('Client-side cascade delete successful', { count: quoteIds.length, quoteIds, duration: `${duration.toFixed(2)}ms` });
          toast.success(`Successfully deleted ${quoteIds.length} quote(s)`);
          fetchQuotes();
          return;
        } catch (fallbackErr: any) {
          const duration = performance.now() - startTime;
          logger.error('Delete failed', {
              error: fallbackErr.message,
              stack: fallbackErr.stack,
              component: 'QuotesList',
              action: 'deleteQuotes',
              quoteIds,
              duration: `${duration.toFixed(2)}ms`
          });
          debug.error('Delete failed (RPC and fallback):', { error: fallbackErr, duration: `${duration.toFixed(2)}ms` });
          toast.error('Failed to delete quotes', { description: fallbackErr.message || err?.message });
        }
        const duration = performance.now() - startTime;
        setLoading(false);
    }
  };

  const handleDeleteQuote = (quoteId: string) => {
    if (confirm('Are you sure you want to delete this quote? This action cannot be undone.')) {
        deleteQuotes([quoteId]);
    }
  };

  const handlePurgeDrafts = () => {
    const draftIds = quotes.filter(q => (q.status || '').toLowerCase() === 'draft').map(q => q.id);
    if (draftIds.length === 0) {
        toast.info('No draft quotes found to purge');
        return;
    }
    if (confirm(`Are you sure you want to delete all ${draftIds.length} draft quotes? This action cannot be undone.`)) {
        deleteQuotes(draftIds);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href="/dashboard/quotes" className="font-semibold text-primary">Quotes</BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">Quote Management</h1>
            <p className="text-muted-foreground">Monitor performance and manage sales proposals.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ViewToggle
              value={viewMode}
              modes={['pipeline','list','grid']}
              onChange={(v) => v === 'pipeline' ? navigate('/dashboard/quotes/pipeline') : setViewMode(v)}
            />
            <Button variant="outline" onClick={() => navigate('/dashboard/quotes/templates')} className="px-3 md:px-4">
                <FileText className="h-4 w-4 md:mr-2" /> 
                <span className="hidden md:inline">Templates</span>
            </Button>
            <Button variant="outline" className="text-destructive hover:bg-destructive/10 border-destructive/50 px-3 md:px-4" onClick={handlePurgeDrafts}>
                <Trash2 className="h-4 w-4 md:mr-2" /> 
                <span className="hidden md:inline">Purge Drafts</span>
            </Button>
            <QuickQuoteModal>
                <Button variant="outline" className="gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Quick Quote
                </Button>
            </QuickQuoteModal>
            <Button onClick={() => navigate('/dashboard/quotes/new')} className="shadow-lg shadow-primary/20 gap-2 min-w-[140px]">
                <Plus className="h-4 w-4" /> 
                <span className="hidden sm:inline">Create Detailed Quote</span>
                <span className="sm:hidden">Detailed Quote</span>
            </Button>
          </div>
        </div>

        {/* Metrics Dashboard */}
        <QuoteMetrics quotes={quotes} loading={loading} />

        {/* Filters toolbar */}
        {!loading && quotes.length > 0 && (
          <Card className="border-none shadow-none bg-muted/30">
            <CardContent className="p-0">
              <div className="flex flex-wrap items-end gap-3 p-4 border rounded-xl bg-background shadow-sm">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1 w-full border-b pb-2">
                    <Filter className="h-4 w-4" /> Filters & Search
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-3 w-full">
                    <div className="space-y-1">
                        <Label className="text-xs">Quote Number</Label>
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                            <Input 
                                placeholder="Search..." 
                                className="pl-8 h-9" 
                                value={quoteNumberQuery} 
                                onChange={(e) => setQuoteNumberQuery(e.target.value)} 
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Customer</Label>
                         <Input 
                            placeholder="Customer Name" 
                            className="h-9" 
                            value={customerQuery} 
                            onChange={(e) => setCustomerQuery(e.target.value)} 
                        />
                    </div>
                     <div className="space-y-1">
                        <Label className="text-xs">Status</Label>
                        <Select value={quoteStatus} onValueChange={setQuoteStatus}>
                            <SelectTrigger className="h-9">
                                <SelectValue placeholder="All Statuses" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="any">All Statuses</SelectItem>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="sent">Sent</SelectItem>
                                <SelectItem value="accepted">Accepted</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-1">
                        <Label className="text-xs">Min Value ($)</Label>
                        <Input 
                            type="number" 
                            placeholder="0.00" 
                            className="h-9" 
                            value={minSellPrice} 
                            onChange={(e) => setMinSellPrice(e.target.value)} 
                        />
                    </div>
                     <div className="flex items-end">
                        <Button variant="ghost" size="sm" onClick={() => {
                            setQuoteNumberQuery('');
                            setCustomerQuery('');
                            setQuoteStatus('any');
                            setMinSellPrice('');
                        }} className="text-muted-foreground hover:text-foreground">
                            <XCircle className="h-3.5 w-3.5 mr-1" /> Clear
                        </Button>
                    </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="space-y-4">
             <Skeleton className="h-32 w-full rounded-xl" />
             <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
             </div>
          </div>
        ) : quotes.length === 0 ? (
          <Card className="border-dashed">
            <CardContent>
              <div className="text-center py-12 space-y-4">
                <div className="bg-primary/10 p-4 rounded-full w-fit mx-auto">
                    <FileText className="h-8 w-8 text-primary" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold">No quotes found</h3>
                    <p className="text-muted-foreground">Get started by creating your first sales proposal.</p>
                </div>
                <Button onClick={() => navigate('/dashboard/quotes/new')}>Create Quote</Button>
              </div>
            </CardContent>
          </Card>
        ) : viewMode === 'list' ? (
          <Card className="shadow-md border-0 ring-1 ring-slate-200">
            <CardContent className="p-0">
              <div className="rounded-md">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <SortableHead label="Quote #" field="quote_number" activeField={sortField} direction={sortDirection} onSort={onSort} />
                    <SortableHead label="Customer" field="customer" activeField={sortField} direction={sortDirection} onSort={onSort} />
                    <SortableHead label="Contact" field="contact" activeField={sortField} direction={sortDirection} onSort={onSort} />
                    <SortableHead label="Value" field="sell_price" activeField={sortField} direction={sortDirection} onSort={onSort} />
                    <SortableHead label="Status" field="status" activeField={sortField} direction={sortDirection} onSort={onSort} />
                    <SortableHead label="Created" field="created_at" activeField={sortField} direction={sortDirection} onSort={onSort} />
                    <TableCell className="w-[50px]"></TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedQuotes.map((q) => (
                    <TableRow key={q.id} className="cursor-pointer hover:bg-blue-50/50 transition-colors group">
                      <TableCell className="font-medium text-blue-600" onClick={() => navigate(`/dashboard/quotes/${q.id}`)}>{q.quote_number || q.id.slice(0,8)}</TableCell>
                      <TableCell className="font-medium" onClick={() => navigate(`/dashboard/quotes/${q.id}`)}>{q.accounts?.name || '-'}</TableCell>
                      <TableCell className="text-muted-foreground" onClick={() => navigate(`/dashboard/quotes/${q.id}`)}>
                        {q.contacts ? `${q.contacts.first_name} ${q.contacts.last_name}` : '-'}
                      </TableCell>
                      <TableCell className="font-semibold" onClick={() => navigate(`/dashboard/quotes/${q.id}`)}>
                         {currency.format(Number(q.sell_price || 0))}
                      </TableCell>
                      <TableCell onClick={() => navigate(`/dashboard/quotes/${q.id}`)}>
                        <Badge variant={statusVariant(q.status) as any} className="uppercase text-[10px] tracking-wider">
                            {q.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs" onClick={() => navigate(`/dashboard/quotes/${q.id}`)}>
                         {new Date(q.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                         <DropdownMenu>
                           <DropdownMenuTrigger asChild>
                             <Button variant="ghost" className="h-8 w-8 p-0">
                               <span className="sr-only">Open menu</span>
                               <MoreHorizontal className="h-4 w-4" />
                             </Button>
                           </DropdownMenuTrigger>
                           <DropdownMenuContent align="end">
                             <DropdownMenuLabel>Actions</DropdownMenuLabel>
                             <DropdownMenuItem onClick={() => navigate(`/dashboard/quotes/${q.id}`)}>
                               <Eye className="mr-2 h-4 w-4" /> View Details
                             </DropdownMenuItem>
                             <DropdownMenuItem onClick={() => navigate(`/dashboard/quotes/${q.id}`)}>
                               <Pencil className="mr-2 h-4 w-4" /> Edit Quote
                             </DropdownMenuItem>
                             <Separator className="my-1" />
                             <DropdownMenuItem 
                                className="text-destructive focus:text-destructive cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteQuote(q.id);
                                }}
                             >
                               <Trash2 className="mr-2 h-4 w-4" /> Delete Quote
                             </DropdownMenuItem>
                           </DropdownMenuContent>
                         </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
            
            <div className="flex items-center justify-between p-4 border-t bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground hidden md:block">Rows per page</p>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(value) => setPageSize(Number(value))}
                  >
                    <SelectTrigger className="h-8 w-[70px]">
                      <SelectValue placeholder={String(pageSize)} />
                    </SelectTrigger>
                    <SelectContent side="top">
                      {pageSizeOptions.map((size) => (
                        <SelectItem key={size} value={String(size)}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Pagination className="justify-end w-auto mx-0">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationFirst onClick={firstPage} className={!canPrev ? 'pointer-events-none opacity-50' : ''} />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationPrevious onClick={prevPage} className={!canPrev ? 'pointer-events-none opacity-50' : ''} />
                    </PaginationItem>
                    <PaginationItem>
                      <span className="flex items-center justify-center h-9 w-32 text-sm font-medium">
                        Page {currentPage} of {totalPages}
                      </span>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext onClick={nextPage} className={!canNext ? 'pointer-events-none opacity-50' : ''} />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationLast onClick={lastPage} className={!canNext ? 'pointer-events-none opacity-50' : ''} />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
            </div>
          </Card>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {pagedQuotes.map((q) => (
                    <Card key={q.id} className="cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-l-transparent hover:border-l-primary" onClick={() => navigate(`/dashboard/quotes/${q.id}`)}>
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <Badge variant={statusVariant(q.status) as any}>{q.status}</Badge>
                                <span className="text-xs text-muted-foreground">{new Date(q.created_at).toLocaleDateString()}</span>
                            </div>
                            <CardTitle className="text-lg mt-2">{q.accounts?.name || 'Unknown Account'}</CardTitle>
                            <CardDescription>#{q.quote_number || q.id.slice(0,8)}</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-sm text-muted-foreground">Total Value</p>
                                    <p className="text-xl font-bold text-primary">{currency.format(Number(q.sell_price || 0))}</p>
                                </div>
                                <ArrowUpRight className="h-5 w-5 text-muted-foreground" />
                             </div>
                        </CardContent>
                    </Card>
                 ))}
            </div>
        )}
      </div>
    </DashboardLayout>
  );
}
