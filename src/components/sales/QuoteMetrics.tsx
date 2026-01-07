import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Quote } from '@/pages/dashboard/quotes-data';
import { DollarSign, FileText, TrendingUp, CheckCircle2 } from 'lucide-react';

interface QuoteMetricsProps {
  quotes: Quote[];
  loading?: boolean;
}

export function QuoteMetrics({ quotes, loading }: QuoteMetricsProps) {
  const metrics = useMemo(() => {
    if (!quotes.length) return null;

    const totalQuotes = quotes.length;
    const totalValue = quotes.reduce((sum, q) => sum + Number(q.sell_price || 0), 0);
    const acceptedQuotes = quotes.filter(q => q.status === 'accepted').length;
    const winRate = totalQuotes > 0 ? (acceptedQuotes / totalQuotes) * 100 : 0;
    
    // Calculate average margin
    const quotesWithMargin = quotes.filter(q => q.sell_price && q.cost_price);
    const totalMargin = quotesWithMargin.reduce((sum, q) => {
      return sum + (Number(q.sell_price) - Number(q.cost_price));
    }, 0);
    const avgMargin = quotesWithMargin.length > 0 ? totalMargin / quotesWithMargin.length : 0;

    return {
      totalQuotes,
      totalValue,
      winRate,
      avgMargin
    };
  }, [quotes]);

  const currency = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-4 w-4 bg-muted rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-32 bg-muted rounded mb-2" />
              <div className="h-4 w-40 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Quotes</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.totalQuotes}</div>
          <p className="text-xs text-muted-foreground">
            Active proposals in pipeline
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{currency.format(metrics.totalValue)}</div>
          <p className="text-xs text-muted-foreground">
            Total potential revenue
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.winRate.toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground">
            Quotes converted to orders
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg. Margin</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{currency.format(metrics.avgMargin)}</div>
          <p className="text-xs text-muted-foreground">
            Average profit per quote
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
