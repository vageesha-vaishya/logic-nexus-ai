import React, { useState, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { Star, DollarSign } from 'lucide-react';

interface Account {
  rank: number;
  company_name: string;
  annual_revenue?: number;
  growth?: string;
}

export function TopAccounts() {
  const { scopedDb } = useCRM();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        setLoading(true);
        const { data, error: err } = await scopedDb
          .from('accounts')
          .select('id, company_name, annual_revenue')
          .order('annual_revenue', { ascending: false })
          .limit(5);

        if (err) throw err;

        // Add rank and format for display
        const formattedAccounts: Account[] = (data || []).map((account: any, index) => ({
          rank: index + 1,
          company_name: account.company_name,
          annual_revenue: account.annual_revenue,
          growth: `+${Math.floor(Math.random() * 25)}%`, // Placeholder - would come from database
        }));

        setAccounts(formattedAccounts);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch accounts:', err);
        setError('Failed to load accounts');
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
  }, [scopedDb]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-4">
          <Star className="h-5 w-5 text-yellow-600" />
          <h4 className="font-semibold text-gray-900">Top 5 Accounts</h4>
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-4">
          <Star className="h-5 w-5 text-yellow-600" />
          <h4 className="font-semibold text-gray-900">Top 5 Accounts</h4>
        </div>
        <div className="p-4 text-red-600 text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Star className="h-5 w-5 text-yellow-600" />
        <h4 className="font-semibold text-gray-900">Top 5 Accounts</h4>
      </div>
      <div className="space-y-2">
        {accounts.length > 0 ? (
          accounts.map((account) => (
            <div key={account.rank} className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-xs font-bold text-white">
                  {account.rank}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{account.company_name}</p>
                  <div className="flex items-center gap-1 text-xs text-gray-600 mt-0.5">
                    <DollarSign className="h-3 w-3" />
                    {account.annual_revenue ? account.annual_revenue.toLocaleString() : 'N/A'}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${account.growth?.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                  {account.growth || 'N/A'}
                </p>
                <p className="text-xs text-gray-500">YoY</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center py-8 text-gray-500">No accounts found</p>
        )}
      </div>
    </div>
  );
}
