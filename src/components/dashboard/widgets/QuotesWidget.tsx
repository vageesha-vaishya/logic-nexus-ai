import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCRM } from '@/hooks/useCRM';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';

interface Quote {
  id: string;
  quote_number: string;
  total_amount: number;
  status: string;
  account: { name: string } | null;
}

export function QuotesWidget() {
  const { context, scopedDb } = useCRM();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuotes = async () => {
      if (!context?.userId) return;
      
      try {
        const { data, error } = await scopedDb
          .from('quotes')
          .select('id, quote_number, total_amount:total, status, account:accounts(name)')
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) throw error;
        // Transform data to match interface
        const transformed = (data || []).map((q: any) => ({
          ...q,
          account: q.account
        }));
        setQuotes(transformed);
      } catch (error) {
        console.error('Failed to load quotes widget:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuotes();
  }, [context?.userId]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Recent Quotes</CardTitle>
        <FileText className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="flex-1">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : quotes.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            No recent quotes
          </div>
        ) : (
          <div className="space-y-4">
            {quotes.map((quote) => (
              <div key={quote.id} className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">{quote.quote_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {quote.account?.name || 'Unknown Account'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{formatCurrency(quote.total_amount, 'USD', { minimumFractionDigits: 0 })}</p>
                  <Badge variant="outline" className="text-[10px] h-4 px-1">
                    {quote.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <div className="p-4 pt-0 mt-auto border-t">
        <Button variant="ghost" className="w-full text-xs" asChild>
          <Link to="/dashboard/quotes">
            View All Quotes <ArrowRight className="ml-2 h-3 w-3" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
