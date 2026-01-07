import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHeader, TableRow, SortableHead } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext, PaginationFirst, PaginationLast, PaginationLink } from '@/components/ui/pagination';
import { useSort } from '@/hooks/useSort';
import { usePagination } from '@/hooks/usePagination';
import { useCRM } from '@/hooks/useCRM';
import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Skeleton } from '@/components/ui/skeleton';
import { ViewToggle, ViewMode } from '@/components/ui/view-toggle';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Quote, QuoteStatus, statusConfig } from './quotes-data';
import { ScopedDataAccess } from '@/lib/db/access';
import { TrendingUp, TrendingDown, DollarSign, Activity, FileText, CheckCircle2, XCircle, Search, Filter, ArrowUpRight, ArrowDownRight, Eye, Pencil, Trash2, MoreHorizontal, Plus } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { QuoteMetrics } from '@/components/sales/QuoteMetrics';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export default function Quotes() {
  const navigate = useNavigate();
  const { supabase, context } = useCRM();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Filters state and helpers
  type TextOp = 'contains' | 'startsWith' | 'equals' | 'endsWith';

  const [quoteNumberOp, setQuoteNumberOp] = useState<TextOp>('contains');
  const [quoteNumberQuery, setQuoteNumberQuery] = useState('');

  const [customerOp, setCustomerOp] = useState<TextOp>('contains');
  const [customerQuery, setCustomerQuery] = useState('');

  const [contactOp, setContactOp] = useState<TextOp>('contains');
  const [contactQuery, setContactQuery] = useState('');

  const [opportunityOp, setOpportunityOp] = useState<TextOp>('contains');
  const [opportunityQuery, setOpportunityQuery] = useState('');

  const [carrierOp, setCarrierOp] = useState<TextOp>('contains');
  const [carrierQuery, setCarrierQuery] = useState('');

  const [quoteStatus, setQuoteStatus] = useState<string>('any');

  const [minSellPrice, setMinSellPrice] = useState<string>('');
  const [maxSellPrice, setMaxSellPrice] = useState<string>('');
  const [minMargin, setMinMargin] = useState<string>('');

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    const fetchQuotes = async () => {
      try {
        const { data, error } = await supabase
          .from('quotes')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100); // Increased limit for better stats
    
    if (error) throw error;

    // Fetch related data separately
    const quotesWithRelations = await Promise.all(
      (data || []).map(async (quote) => {
        const [account, contact, opportunity, carrier, serviceType] = await Promise.all([
          quote.account_id ? supabase.from('accounts').select('name').eq('id', quote.account_id).single() : null,
          quote.contact_id ? supabase.from('contacts').select('first_name, last_name').eq('id', quote.contact_id).single() : null,
          quote.opportunity_id ? supabase.from('opportunities').select('name').eq('id', quote.opportunity_id).single() : null,
          quote.carrier_id ? supabase.from('carriers').select('carrier_name').eq('id', quote.carrier_id).single() : null,
          quote.service_type_id ? supabase.from('service_types').select('name').eq('id', quote.service_type_id).single() : null,
        ]);

        return {
          ...quote,
          accounts: account?.data || null,
          contacts: contact?.data || null,
          opportunities: opportunity?.data || null,
          carriers: carrier?.data || null,
          service_types: serviceType?.data || null,
        };
      })
    );

        setQuotes(quotesWithRelations as unknown as Quote[]);
      } catch (err: unknown) {
        const description = err instanceof Error ? err.message : String(err);
        toast.error('Failed to load quotes', { description });
      } finally {
        setLoading(false);
      }
    };
    fetchQuotes();
  }, []);

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
    const matchesQuoteNum = matchText(quoteNum, quoteNumberQuery, quoteNumberOp);
    const customerName = q.accounts?.name || '';
    const matchesCustomer = matchText(customerName, customerQuery, customerOp);
    const contactName = q.contacts ? `${q.contacts.first_name} ${q.contacts.last_name}` : '';
    const matchesContact = matchText(contactName, contactQuery, contactOp);
    const opportunityName = q.opportunities?.name || '';
    const matchesOpportunity = matchText(opportunityName, opportunityQuery, opportunityOp);
    const carrierName = q.carriers?.carrier_name || '';
    const matchesCarrier = matchText(carrierName, carrierQuery, carrierOp);
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

  const { sorted: sortedQuotes, sortField, sortDirection, onSort } = useSort<Quote>(
    filteredQuotes,
    {
      initialField: 'created_at',
      initialDirection: 'desc',
      accessors: {
        quote_number: (q: Quote) => q.quote_number || (q.id ? String(q.id).slice(0, 8) : ''),
        customer: (q: Quote) => q.accounts?.name || '',
        contact: (q: Quote) => (q.contacts ? `${q.contacts.first_name} ${q.contacts.last_name}` : ''),
        opportunity: (q: Quote) => q.opportunities?.name || '',
        carrier: (q: Quote) => q.carriers?.carrier_name || '',
        status: (q: Quote) => q.status || '',
        sell_price: (q: Quote) => Number(q.sell_price ?? 0),
        margin: (q: Quote) => (q.sell_price != null && q.cost_price != null ? Number(q.sell_price) - Number(q.cost_price) : 0),
        created_at: (q: Quote) => (q.created_at ? new Date(q.created_at).getTime() : 0),
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
          <div className="flex items-center gap-3">
            <ViewToggle
              value={viewMode}
              modes={['pipeline','list','grid']}
              onChange={(v) => v === 'pipeline' ? navigate('/dashboard/quotes/pipeline') : setViewMode(v)}
            />
            <Button variant="outline" onClick={() => navigate('/dashboard/quotes/templates')}>
                <FileText className="mr-2 h-4 w-4" /> Templates
            </Button>
            <Button onClick={() => navigate('/dashboard/quotes/new')} className="shadow-lg shadow-primary/20">
                <Plus className="mr-2 h-4 w-4" /> New Quote
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
                             <DropdownMenuItem onClick={() => navigate(`/dashboard/quotes/${q.id}/edit`)}>
                               <Pencil className="mr-2 h-4 w-4" /> Edit Quote
                             </DropdownMenuItem>
                             <Separator className="my-1" />
                             <DropdownMenuItem className="text-destructive focus:text-destructive">
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