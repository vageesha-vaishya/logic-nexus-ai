import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCRM } from '@/hooks/useCRM';
import { Skeleton } from '@/components/ui/skeleton';

interface Account {
  id: string;
  name: string;
  industry: string | null;
  status: string;
}

export function AccountsWidget() {
  const { context, scopedDb } = useCRM();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAccounts = async () => {
      if (!context?.userId) return;
      
      try {
        const { data, error } = await scopedDb
          .from('accounts')
          .select('id, name, industry, status')
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) throw error;
        setAccounts(data as Account[]);
      } catch (error) {
        console.error('Failed to load accounts widget:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
  }, [context?.userId]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Recent Accounts</CardTitle>
        <Building2 className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="flex-1">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            No recent accounts
          </div>
        ) : (
          <div className="space-y-4">
            {accounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">{account.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {account.industry || 'No Industry'} • {account.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <div className="p-4 pt-0 mt-auto border-t">
        <Button variant="ghost" className="w-full text-xs" asChild>
          <Link to="/dashboard/accounts">
            View All Accounts <ArrowRight className="ml-2 h-3 w-3" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
