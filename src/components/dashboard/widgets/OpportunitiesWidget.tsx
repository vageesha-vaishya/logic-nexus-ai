import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCRM } from '@/hooks/useCRM';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';

interface Opportunity {
  id: string;
  name: string;
  amount: number;
  stage: string;
  account: { name: string } | null;
}

export function OpportunitiesWidget() {
  const { context, scopedDb } = useCRM();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOpportunities = async () => {
      if (!context?.userId) return;
      
      try {
        const { data, error } = await scopedDb
          .from('opportunities')
          .select('id, name, amount, stage, account:accounts(name)')
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) throw error;
        const transformed = (data || []).map((o: any) => ({
          ...o,
          account: o.account
        }));
        setOpportunities(transformed);
      } catch (error) {
        console.error('Failed to load opportunities widget:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOpportunities();
  }, [context?.userId]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Active Opportunities</CardTitle>
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="flex-1">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : opportunities.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            No active opportunities
          </div>
        ) : (
          <div className="space-y-4">
            {opportunities.map((opp) => (
              <div key={opp.id} className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">{opp.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {opp.account?.name || 'Unknown Account'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{formatCurrency(opp.amount, 'USD', { minimumFractionDigits: 0 })}</p>
                  <Badge variant="secondary" className="text-[10px] h-4 px-1">
                    {opp.stage.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <div className="p-4 pt-0 mt-auto border-t">
        <Button variant="ghost" className="w-full text-xs" asChild>
          <Link to="/dashboard/opportunities">
            View All Opportunities <ArrowRight className="ml-2 h-3 w-3" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
