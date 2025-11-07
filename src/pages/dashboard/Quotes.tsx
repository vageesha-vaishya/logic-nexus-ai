import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import TitleStrip from '@/components/ui/title-strip';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHeader, TableRow, SortableHead } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext, PaginationFirst, PaginationLast, PaginationLink } from '@/components/ui/pagination';
import { useSort } from '@/hooks/useSort';
import { usePagination } from '@/hooks/usePagination';
import { useCRM } from '@/hooks/useCRM';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList } from '@/components/ui/breadcrumb';
import { Skeleton } from '@/components/ui/skeleton';
import { ViewToggle, ViewMode } from '@/components/ui/view-toggle';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { LayoutGrid } from 'lucide-react';

export default function Quotes() {
  const navigate = useNavigate();
  const { supabase } = useCRM();
  const [quotes, setQuotes] = useState<any[]>([]);
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
      .limit(50);
    
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

        setQuotes(quotesWithRelations);
      } catch (err: any) {
        toast.error('Failed to load quotes', { description: err.message });
      } finally {
        setLoading(false);
      }
    };
    fetchQuotes();
  }, []);

  const currency = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });

  const statusVariant = (status?: string) => {
    switch ((status || '').toLowerCase()) {
      case 'accepted':
        return 'success';
      case 'sent':
        return 'secondary';
      case 'rejected':
        return 'destructive';
      case 'draft':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const matchText = (value: string | undefined | null, query: string, op: TextOp) => {
    if (!query) return true;
    const v = (value || '').toLowerCase();
    const q = query.toLowerCase();
    switch (op) {
      case 'contains':
        return v.includes(q);
      case 'startsWith':
        return v.startsWith(q);
      case 'equals':
        return v === q;
      case 'endsWith':
        return v.endsWith(q);
      default:
        return true;
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
      matchesQuoteNum &&
      matchesCustomer &&
      matchesContact &&
      matchesOpportunity &&
      matchesCarrier &&
      matchesStatus &&
      matchesMinSell &&
      matchesMaxSell &&
      matchesMinMargin &&
      startOk &&
      endOk
    );
  });

  const { sorted: sortedQuotes, sortField, sortDirection, onSort } = useSort<any>(
    filteredQuotes,
    {
      initialField: 'created_at',
      initialDirection: 'desc',
      accessors: {
        quote_number: (q: any) => q.quote_number || (q.id ? String(q.id).slice(0, 8) : ''),
        customer: (q: any) => q.accounts?.name || '',
        contact: (q: any) => (q.contacts ? `${q.contacts.first_name} ${q.contacts.last_name}` : ''),
        opportunity: (q: any) => q.opportunities?.name || '',
        carrier: (q: any) => q.carriers?.carrier_name || '',
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="space-y-2">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/dashboard/quotes">Quotes</BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div>
              <h1 className="text-3xl font-bold">Quotes</h1>
              <p className="text-muted-foreground">Manage customer quotations</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ViewToggle value={viewMode} onChange={setViewMode} />
            <Button variant="outline" onClick={() => navigate('/dashboard/quotes/pipeline')}>
              <LayoutGrid className="mr-2 h-4 w-4" />
              Pipeline View
            </Button>
            <Button onClick={() => navigate('/dashboard/quotes/new')}>New Quote</Button>
          </div>
        </div>

        {/* Filters toolbar shown when not loading and there is data */}
        {!loading && quotes.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label>Quote number</Label>
                  <div className="flex gap-2">
                    <Select value={quoteNumberOp} onValueChange={(v) => setQuoteNumberOp(v as TextOp)}>
                      <SelectTrigger className="w-[160px]"><SelectValue placeholder="Operator" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contains">Contains</SelectItem>
                        <SelectItem value="startsWith">Starts With</SelectItem>
                        <SelectItem value="equals">Equals</SelectItem>
                        <SelectItem value="endsWith">Ends With</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="Search number" value={quoteNumberQuery} onChange={(e) => setQuoteNumberQuery(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Customer</Label>
                  <div className="flex gap-2">
                    <Select value={customerOp} onValueChange={(v) => setCustomerOp(v as TextOp)}>
                      <SelectTrigger className="w-[160px]"><SelectValue placeholder="Operator" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contains">Contains</SelectItem>
                        <SelectItem value="startsWith">Starts With</SelectItem>
                        <SelectItem value="equals">Equals</SelectItem>
                        <SelectItem value="endsWith">Ends With</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="Search customer" value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Contact</Label>
                  <div className="flex gap-2">
                    <Select value={contactOp} onValueChange={(v) => setContactOp(v as TextOp)}>
                      <SelectTrigger className="w-[160px]"><SelectValue placeholder="Operator" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contains">Contains</SelectItem>
                        <SelectItem value="startsWith">Starts With</SelectItem>
                        <SelectItem value="equals">Equals</SelectItem>
                        <SelectItem value="endsWith">Ends With</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="Search contact" value={contactQuery} onChange={(e) => setContactQuery(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Opportunity</Label>
                  <div className="flex gap-2">
                    <Select value={opportunityOp} onValueChange={(v) => setOpportunityOp(v as TextOp)}>
                      <SelectTrigger className="w-[160px]"><SelectValue placeholder="Operator" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contains">Contains</SelectItem>
                        <SelectItem value="startsWith">Starts With</SelectItem>
                        <SelectItem value="equals">Equals</SelectItem>
                        <SelectItem value="endsWith">Ends With</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="Search opportunity" value={opportunityQuery} onChange={(e) => setOpportunityQuery(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Carrier</Label>
                  <div className="flex gap-2">
                    <Select value={carrierOp} onValueChange={(v) => setCarrierOp(v as TextOp)}>
                      <SelectTrigger className="w-[160px]"><SelectValue placeholder="Operator" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contains">Contains</SelectItem>
                        <SelectItem value="startsWith">Starts With</SelectItem>
                        <SelectItem value="equals">Equals</SelectItem>
                        <SelectItem value="endsWith">Ends With</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="Search carrier" value={carrierQuery} onChange={(e) => setCarrierQuery(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={quoteStatus} onValueChange={(v) => setQuoteStatus(v)}>
                    <SelectTrigger><SelectValue placeholder="Any status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="accepted">Accepted</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Sell price range</Label>
                  <div className="flex gap-2">
                    <Input type="number" placeholder="Min" value={minSellPrice} onChange={(e) => setMinSellPrice(e.target.value)} />
                    <Input type="number" placeholder="Max" value={maxSellPrice} onChange={(e) => setMaxSellPrice(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Min margin</Label>
                  <Input type="number" placeholder="Min margin" value={minMargin} onChange={(e) => setMinMargin(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>Created date range</Label>
                  <div className="flex gap-2">
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="text-xs text-muted-foreground">Cards per page</div>
                  <Select value={String(pageSize)} onValueChange={(v) => setPageSize(v === 'ALL' ? 'ALL' : Number(v))}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Cards" />
                    </SelectTrigger>
                    <SelectContent>
                      {pageSizeOptions.map((opt) => (
                        <SelectItem key={String(opt)} value={String(opt)}>{String(opt)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Pagination className="justify-end">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationFirst onClick={firstPage} className={!canPrev ? 'pointer-events-none opacity-50' : ''} />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationPrevious onClick={prevPage} className={!canPrev ? 'pointer-events-none opacity-50' : ''} />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationLink isActive size="default">Page {currentPage} of {totalPages}</PaginationLink>
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
            </CardContent>
          </Card>
        )}

        {loading ? (
          <Card>
            <CardHeader>
              <CardTitle>All Quotes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="grid grid-cols-9 gap-4 items-center">
                    {[...Array(9)].map((__, j) => (
                      <Skeleton key={`${i}-${j}`} className="h-4 w-full" />
                    ))}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : quotes.length === 0 ? (
          <Card>
            <CardContent>
              <div className="text-center py-10 space-y-3">
                <p className="text-muted-foreground">No quotes yet</p>
                <Button onClick={() => navigate('/dashboard/quotes/new')} size="sm">Create your first quote</Button>
              </div>
            </CardContent>
          </Card>
        ) : viewMode === 'list' ? (
          <Card>
            <CardHeader>
              <TitleStrip label="All Quotes" />
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead label="Quote #" field="quote_number" activeField={sortField} direction={sortDirection} onSort={onSort} />
                    <SortableHead label="Customer" field="customer" activeField={sortField} direction={sortDirection} onSort={onSort} />
                    <SortableHead label="Contact" field="contact" activeField={sortField} direction={sortDirection} onSort={onSort} />
                    <SortableHead label="Opportunity" field="opportunity" activeField={sortField} direction={sortDirection} onSort={onSort} />
                    <SortableHead label="Carrier" field="carrier" activeField={sortField} direction={sortDirection} onSort={onSort} />
                    <SortableHead label="Status" field="status" activeField={sortField} direction={sortDirection} onSort={onSort} />
                    <SortableHead label="Sell Price" field="sell_price" activeField={sortField} direction={sortDirection} onSort={onSort} />
                    <SortableHead label="Margin" field="margin" activeField={sortField} direction={sortDirection} onSort={onSort} />
                    <SortableHead label="Created" field="created_at" activeField={sortField} direction={sortDirection} onSort={onSort} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedQuotes.map((q) => (
                    <TableRow key={q.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/dashboard/quotes/${q.id}`)}>
                      <TableCell className="font-medium">{q.quote_number || q.id.slice(0,8)}</TableCell>
                      <TableCell>{q.accounts?.name || '-'}</TableCell>
                      <TableCell>
                        {q.contacts ? `${q.contacts.first_name} ${q.contacts.last_name}` : '-'}
                      </TableCell>
                      <TableCell>{q.opportunities?.name || '-'}</TableCell>
                      <TableCell>{q.carriers?.carrier_name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(q.status)} className="capitalize">{q.status || 'unknown'}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{q.sell_price != null ? currency.format(q.sell_price) : currency.format(0)}</TableCell>
                      <TableCell>
                        {q.sell_price && q.cost_price ? (
                          <span className={`${(q.sell_price - q.cost_price) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {currency.format((q.sell_price - q.cost_price))}
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell>{new Date(q.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="text-xs text-muted-foreground">Rows per page</div>
                  <Select value={String(pageSize)} onValueChange={(v) => setPageSize(v === 'ALL' ? 'ALL' : Number(v))}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Rows" />
                    </SelectTrigger>
                    <SelectContent>
                      {pageSizeOptions.map((opt) => (
                        <SelectItem key={String(opt)} value={String(opt)}>{String(opt)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Pagination className="justify-end">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationFirst onClick={firstPage} className={!canPrev ? 'pointer-events-none opacity-50' : ''} />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationPrevious onClick={prevPage} className={!canPrev ? 'pointer-events-none opacity-50' : ''} />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationLink isActive size="default">Page {currentPage} of {totalPages}</PaginationLink>
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
              </div>
            </CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          <Card>
            <CardHeader>
              <CardTitle>All Quotes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {pagedQuotes.map((q) => (
                  <div key={q.id} className="border rounded-lg p-3 hover:bg-muted/50 cursor-pointer" onClick={() => navigate(`/dashboard/quotes/${q.id}`)}>
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{q.quote_number || q.id.slice(0,8)}</div>
                      <Badge variant={statusVariant(q.status)} className="capitalize">{q.status || 'unknown'}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">{q.accounts?.name || '-'}</div>
                    <div className="mt-3 flex items-center justify-between">
                      <div>
                        <div className="text-xs text-muted-foreground">Sell</div>
                        <div className="font-medium">{q.sell_price != null ? currency.format(q.sell_price) : currency.format(0)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Margin</div>
                        <div className={`${(q.sell_price && q.cost_price && (q.sell_price - q.cost_price) > 0) ? 'text-green-600' : 'text-red-600'} font-medium`}>
                          {q.sell_price && q.cost_price ? currency.format((q.sell_price - q.cost_price)) : '-'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Created</div>
                        <div className="font-medium">{new Date(q.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {pagedQuotes.map((q) => (
              <Card key={q.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => navigate(`/dashboard/quotes/${q.id}`)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-xl font-semibold">{q.quote_number || q.id.slice(0,8)}</div>
                      <Badge variant={statusVariant(q.status)} className="capitalize">{q.status || 'unknown'}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">{new Date(q.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="mt-2 text-muted-foreground">
                    <div>Customer: <span className="text-foreground">{q.accounts?.name || '-'}</span></div>
                    <div>Contact: <span className="text-foreground">{q.contacts ? `${q.contacts.first_name} ${q.contacts.last_name}` : '-'}</span></div>
                    <div>Opportunity: <span className="text-foreground">{q.opportunities?.name || '-'}</span></div>
                    <div>Carrier: <span className="text-foreground">{q.carriers?.carrier_name || '-'}</span></div>
                  </div>
                  <div className="mt-3 flex items-center gap-6">
                    <div>
                      <div className="text-xs text-muted-foreground">Sell Price</div>
                      <div className="font-medium">{q.sell_price != null ? currency.format(q.sell_price) : currency.format(0)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Cost Price</div>
                      <div className="font-medium">{q.cost_price != null ? currency.format(q.cost_price) : '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Margin</div>
                      <div className={`${(q.sell_price && q.cost_price && (q.sell_price - q.cost_price) > 0) ? 'text-green-600' : 'text-red-600'} font-medium`}>
                        {q.sell_price && q.cost_price ? currency.format((q.sell_price - q.cost_price)) : '-'}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="text-xs text-muted-foreground">Cards per page</div>
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(v === 'ALL' ? 'ALL' : Number(v))}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Cards" />
                  </SelectTrigger>
                  <SelectContent>
                    {pageSizeOptions.map((opt) => (
                      <SelectItem key={String(opt)} value={String(opt)}>{String(opt)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Pagination className="justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationFirst onClick={firstPage} className={!canPrev ? 'pointer-events-none opacity-50' : ''} />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationPrevious onClick={prevPage} className={!canPrev ? 'pointer-events-none opacity-50' : ''} />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLink isActive size="default">Page {currentPage} of {totalPages}</PaginationLink>
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
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
