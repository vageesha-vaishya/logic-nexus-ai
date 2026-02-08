import { useState, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Search, Filter, Loader2, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface QuoteSelectionGridProps {
  onSelectQuote: (quote: any) => void;
}

export function QuoteSelectionGrid({ onSelectQuote }: QuoteSelectionGridProps) {
  const { scopedDb } = useCRM();
  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [statusFilters, setStatusFilters] = useState<string[]>(['approved', 'accepted']);
  const [amountRange, setAmountRange] = useState<[number, number]>([0, 100000]);
  const [currency, setCurrency] = useState<string>('USD');
  
  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    fetchQuotes();
  }, [page, searchQuery, dateRange, statusFilters, amountRange, currency]);

  const fetchQuotes = async () => {
    setLoading(true);
    try {
      let query = scopedDb
        .from('quotes')
        .select('*, accounts(name)', { count: 'exact' });

      // Search
      if (searchQuery) {
        query = query.or(`quote_number.ilike.%${searchQuery}%,title.ilike.%${searchQuery}%`);
      }

      // Status Filter
      if (statusFilters.length > 0) {
        query = query.in('status', statusFilters);
      }

      // Date Range Filter
      if (dateRange?.from) {
        query = query.gte('created_at', dateRange.from.toISOString());
        if (dateRange.to) {
          query = query.lte('created_at', dateRange.to.toISOString());
        }
      }

      // Amount Range
      if (amountRange) {
        query = query.gte('total_amount', amountRange[0]);
        // If max is the slider max, assume open-ended or high limit
        if (amountRange[1] < 100000) {
            query = query.lte('total_amount', amountRange[1]);
        }
      }
      
      // Currency
      if (currency && currency !== 'ALL') {
          query = query.eq('currency', currency);
      }

      // Pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      
      const { data, count, error } = await query
        .range(from, to)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setQuotes(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching quotes:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const toggleStatus = (status: string) => {
    setStatusFilters(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <CardTitle>Select Quotation</CardTitle>
                <CardDescription>Choose a quotation to map to a booking.</CardDescription>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search quote # or title..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8"
                        data-testid="mapper-search-input"
                    />
                </div>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="gap-2">
                            <Filter className="h-4 w-4" />
                            Filters
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-4" align="end">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    {['draft', 'approved', 'accepted', 'rejected', 'expired'].map(status => (
                                        <div key={status} className="flex items-center space-x-2">
                                            <Checkbox 
                                                id={`status-${status}`} 
                                                checked={statusFilters.includes(status)}
                                                onCheckedChange={() => toggleStatus(status)}
                                                data-testid={`status-filter-${status}`}
                                            />
                                            <Label htmlFor={`status-${status}`} className="capitalize">{status}</Label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <Label>Amount Range ({currency})</Label>
                                <div className="pt-2">
                                    <Slider
                                        min={0}
                                        max={100000}
                                        step={1000}
                                        value={amountRange}
                                        onValueChange={(val) => setAmountRange(val as [number, number])}
                                    />
                                </div>
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>{amountRange[0].toLocaleString()}</span>
                                    <span>{amountRange[1] >= 100000 ? '100k+' : amountRange[1].toLocaleString()}</span>
                                </div>
                            </div>

                             <div className="space-y-2">
                                <Label>Currency</Label>
                                <Select value={currency} onValueChange={setCurrency}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">All Currencies</SelectItem>
                                        <SelectItem value="USD">USD</SelectItem>
                                        <SelectItem value="EUR">EUR</SelectItem>
                                        <SelectItem value="GBP">GBP</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
        </div>
        <div className="mt-4">
             <DateRangePicker 
                date={dateRange}
                onDateChange={setDateRange}
                className="w-full sm:w-[300px]"
            />
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quote Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total Amount</TableHead>
                <TableHead>Valid Until</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : quotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No quotations found.
                  </TableCell>
                </TableRow>
              ) : (
                quotes.map((quote) => (
                  <TableRow key={quote.id}>
                    <TableCell className="font-medium">{quote.quote_number}</TableCell>
                    <TableCell>{quote.accounts?.name || 'Unknown'}</TableCell>
                    <TableCell>
                      <Badge variant={
                        quote.status === 'approved' || quote.status === 'accepted' ? 'default' : 
                        quote.status === 'draft' ? 'secondary' : 'destructive'
                      }>
                        {quote.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {quote.total_amount?.toLocaleString()} {quote.currency}
                    </TableCell>
                    <TableCell>
                      {quote.valid_until ? format(new Date(quote.valid_until), 'MMM dd, yyyy') : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => onSelectQuote(quote)} data-testid="select-quote-btn">
                        Select <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
            <div className="mt-4">
                <Pagination>
                    <PaginationContent>
                        <PaginationItem>
                            <PaginationPrevious 
                                href="#" 
                                onClick={(e) => { e.preventDefault(); if(page > 1) setPage(p => p - 1); }} 
                                className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                            />
                        </PaginationItem>
                        {Array.from({ length: totalPages }).map((_, i) => (
                            <PaginationItem key={i}>
                                <PaginationLink 
                                    href="#" 
                                    isActive={page === i + 1}
                                    onClick={(e) => { e.preventDefault(); setPage(i + 1); }}
                                >
                                    {i + 1}
                                </PaginationLink>
                            </PaginationItem>
                        ))}
                        <PaginationItem>
                            <PaginationNext 
                                href="#" 
                                onClick={(e) => { e.preventDefault(); if(page < totalPages) setPage(p => p + 1); }}
                                className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
                            />
                        </PaginationItem>
                    </PaginationContent>
                </Pagination>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
