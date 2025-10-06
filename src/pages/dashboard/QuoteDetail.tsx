import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

export default function QuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { supabase } = useCRM();
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState('');

  useEffect(() => {
    const fetchQuote = async () => {
      try {
        const { data, error } = await supabase
          .from('quotes')
          .select('*')
          .eq('id', id)
          .single();
        if (error) throw error;
        const row = data as any;
        setQuote(row);
        setTotal(String(row?.total ?? ''));
      } catch (err: any) {
        toast.error('Failed to load quote', { description: err.message });
        navigate('/dashboard/quotes');
      } finally {
        setLoading(false);
      }
    };
    fetchQuote();
  }, [id]);

  const saveTotals = async () => {
    try {
      const { error } = await supabase
        .from('quotes')
        .update({ total: total ? Number(total) : null } as any)
        .eq('id', id);
      if (error) throw error;
      toast.success('Quote updated');
    } catch (err: any) {
      toast.error('Failed to update quote', { description: err.message });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      </DashboardLayout>
    );
  }

  if (!quote) return null;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Quote {quote.quote_number || id?.slice(0,8)}</h1>
            <p className="text-muted-foreground">Status: {quote.status}</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/dashboard/quotes')}>Back</Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Totals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="total">Total (USD)</Label>
              <Input id="total" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0.00" />
            </div>
            <Button onClick={saveTotals}>Save</Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
