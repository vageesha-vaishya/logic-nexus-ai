import React, { useState, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { EnterpriseTable, type Column } from '@/components/ui/enterprise';

interface Account {
  id: string;
  company_name: string;
  annual_revenue?: number;
  status: string;
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
          .select('id, company_name, annual_revenue, status')
          .order('annual_revenue', { ascending: false })
          .limit(10);

        if (err) throw err;
        setAccounts(data || []);
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

  const columns: Column<Account>[] = [
    { key: 'company_name', label: 'Company', width: '250px' },
    {
      key: 'annual_revenue',
      label: 'Annual Revenue',
      width: '150px',
      render: (v) =>
        v
          ? new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              maximumFractionDigits: 0,
            }).format(v)
          : 'N/A',
    },
    { key: 'status', label: 'Status', width: '100px' },
  ];

  if (loading) return <div className="p-4">Loading accounts...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  return (
    <EnterpriseTable
      columns={columns}
      data={accounts}
      rowKey={(row) => row.id}
      onRowClick={(row) => console.log('Selected:', row)}
      emptyState={
        <p className="text-center py-8 text-gray-500">No accounts found</p>
      }
    />
  );
}
