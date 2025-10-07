import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCRM } from '@/hooks/useCRM';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList } from '@/components/ui/breadcrumb';
import { Skeleton } from '@/components/ui/skeleton';
import { ViewToggle, ViewMode } from '@/components/ui/view-toggle';

export default function Quotes() {
  const navigate = useNavigate();
  const { supabase } = useCRM();
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

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
            const [account, contact, opportunity, carrier] = await Promise.all([
              quote.account_id ? supabase.from('accounts').select('name').eq('id', quote.account_id).single() : null,
              quote.contact_id ? supabase.from('contacts').select('first_name, last_name').eq('id', quote.contact_id).single() : null,
              quote.opportunity_id ? supabase.from('opportunities').select('name').eq('id', quote.opportunity_id).single() : null,
              quote.carrier_id ? supabase.from('carriers').select('carrier_name').eq('id', quote.carrier_id).single() : null,
            ]);

            return {
              ...quote,
              accounts: account?.data || null,
              contacts: contact?.data || null,
              opportunities: opportunity?.data || null,
              carriers: carrier?.data || null,
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
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
            <Button onClick={() => navigate('/dashboard/quotes/new')}>New Quote</Button>
          </div>
        </div>

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
              <CardTitle>All Quotes</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quote #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Opportunity</TableHead>
                    <TableHead>Carrier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sell Price</TableHead>
                    <TableHead>Margin</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotes.map((q) => (
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
            </CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          <Card>
            <CardHeader>
              <CardTitle>All Quotes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {quotes.map((q) => (
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
            {quotes.map((q) => (
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
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
