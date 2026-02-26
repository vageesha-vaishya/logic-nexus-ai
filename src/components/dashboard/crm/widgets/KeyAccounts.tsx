import React, { useState, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { Building2, DollarSign, Globe } from 'lucide-react';

interface KeyAccount {
  id: string;
  name: string;
  industry: string;
  revenue: number;
}

export function KeyAccounts() {
  const { scopedDb } = useCRM();
  const [accounts, setAccounts] = useState<KeyAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        setLoading(true);
        // Fetch accounts sorted by revenue
        const { data, error } = await scopedDb
          .from('accounts')
          .select('id, company_name, industry, annual_revenue')
          .order('annual_revenue', { ascending: false })
          .limit(5);

        if (!error && data) {
          const result = data.map((acc: any) => ({
            id: acc.id,
            name: acc.company_name,
            industry: acc.industry || 'Unknown',
            revenue: acc.annual_revenue || 0,
          }));

          setAccounts(result);
        }
      } catch (error) {
        console.error('Failed to fetch key accounts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
  }, [scopedDb]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Building2 className="h-5 w-5 text-indigo-600" />
        <h4 className="font-semibold text-gray-900">Key Strategic Accounts</h4>
      </div>
      
      <div className="space-y-3">
        {accounts.length > 0 ? accounts.map((account) => (
          <div key={account.id} className="p-3 bg-white border rounded-lg shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-50 text-blue-600">
                <Globe className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{account.name}</p>
                <p className="text-xs text-gray-500">{account.industry}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-gray-900">${(account.revenue / 1000000).toFixed(1)}M</p>
              <div className="flex items-center justify-end gap-1 text-xs text-green-600">
                <DollarSign className="h-3 w-3" />
                <span>Annual Rev</span>
              </div>
            </div>
          </div>
        )) : (
          <p className="text-center py-4 text-gray-500">No key accounts found</p>
        )}
      </div>
    </div>
  );
}
