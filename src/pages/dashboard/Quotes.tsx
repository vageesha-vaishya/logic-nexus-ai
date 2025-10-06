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
          .select('*')
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
                    <TableHead>Status</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotes.map((q) => (
                    <TableRow key={q.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/dashboard/quotes/${q.id}`)}>
                      <TableCell className="font-medium">{q.quote_number || q.id.slice(0,8)}</TableCell>
                      <TableCell>{q.customer_id || '-'}</TableCell>
                      <TableCell className="capitalize">{q.status}</TableCell>
                      <TableCell>{q.total ?? 0}</TableCell>
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
