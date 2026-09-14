import React, { useState, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { Building2, Globe, DollarSign } from 'lucide-react';
import { logger } from "@/lib/logger";

interface Account {
  id: string;
  company_name: string;
  industry?: string;
  status?: string;
  annual_revenue?: number;
}

export function MyAccounts() {
  const { scopedDb, contextReady } = useCRM();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!contextReady) return;
    const fetchAccounts = async () => {
      try {
        setLoading(true);
        const { data, error } = await scopedDb
          .from('v_accounts')
          .select('id, company_name, industry, status, annual_revenue')
          .limit(4);

        if (!error && data) {
          setAccounts(data);
        }
      } catch (error) {
        logger.error('Failed to fetch accounts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
  }, [scopedDb, contextReady]);

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-status-success text-status-success-foreground';
      case 'at risk':
        return 'bg-status-danger text-status-danger-foreground';
      case 'inactive':
        return 'bg-status-neutral text-status-neutral-foreground';
      default:
        return 'bg-status-info text-status-info-foreground';
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="h-5 w-5 text-blue-600" />
          <h4 className="font-semibold text-gray-900">My Accounts</h4>
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Building2 className="h-5 w-5 text-blue-600" />
        <h4 className="font-semibold text-gray-900">My Accounts</h4>
      </div>
      <div className="space-y-2">
        {accounts.length > 0 ? (
          accounts.map((account) => (
            <div key={account.id} className="p-3 bg-gray-50 rounded border border-gray-200">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-medium text-gray-900">{account.company_name}</p>
                  <p className="text-xs text-gray-600 flex items-center gap-1 mt-1">
                    <Globe className="h-3 w-3" />
                    {account.industry || 'N/A'}
                  </p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded ${getStatusColor(account.status)}`}>
                  {account.status || 'Active'}
                </span>
              </div>
              <div className="flex items-center gap-1 text-green-600 font-semibold text-sm">
                <DollarSign className="h-4 w-4" />
                {account.annual_revenue ? `$${account.annual_revenue.toLocaleString()}` : 'N/A'}
              </div>
            </div>
          ))
        ) : (
          <p className="text-center py-4 text-gray-500">No accounts found</p>
        )}
      </div>
    </div>
  );
}
