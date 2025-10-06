import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCRM } from '@/hooks/useCRM';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function Quotes() {
  const navigate = useNavigate();
  const { supabase } = useCRM();
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuotes = async () => {
      try {
        const { data, error } = await supabase
          .from('quotes')
          .select(`
            *,
            accounts:account_id(name),
            contacts:contact_id(first_name, last_name),
            opportunities:opportunity_id(name),
            carriers:carrier_id(carrier_name)
          `)
          .order('created_at', { ascending: false })
          .limit(50);
        if (error) throw error;
        setQuotes(data || []);
      } catch (err: any) {
        toast.error('Failed to load quotes', { description: err.message });
      } finally {
        setLoading(false);
      }
    };
    fetchQuotes();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Quotes</h1>
            <p className="text-muted-foreground">Manage customer quotations</p>
          </div>
          <Button onClick={() => navigate('/dashboard/quotes/new')}>New Quote</Button>
        </div>

        {loading ? (
          <Card>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            </CardContent>
          </Card>
        ) : quotes.length === 0 ? (
          <Card>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">No quotes yet</div>
            </CardContent>
          </Card>
        ) : (
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
                        <span className={`px-2 py-1 rounded text-xs ${
                          q.status === 'accepted' ? 'bg-green-100 text-green-800' :
                          q.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                          q.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {q.status}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">${q.sell_price?.toFixed(2) || '0.00'}</TableCell>
                      <TableCell>
                        {q.sell_price && q.cost_price ? (
                          <span className={`${(q.sell_price - q.cost_price) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ${(q.sell_price - q.cost_price).toFixed(2)}
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
        )}
      </div>
    </DashboardLayout>
  );
}
