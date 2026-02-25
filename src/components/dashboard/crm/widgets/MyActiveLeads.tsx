import React, { useState, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { EnterpriseTable, type Column } from '@/components/ui/enterprise';

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  created_at: string;
}

export function MyActiveLeads() {
  const { scopedDb } = useCRM();
  const [leads, setLeads] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        setLoading(true);
        const { data, error: err } = await scopedDb
          .from('contacts')
          .select('id, first_name, last_name, email, phone, created_at')
          .order('created_at', { ascending: false })
          .limit(10);

        if (err) throw err;
        setLeads(data || []);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch leads:', err);
        setError('Failed to load leads');
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();
  }, [scopedDb]);

  const columns: Column<Contact>[] = [
    { key: 'first_name', label: 'First Name', width: '150px' },
    { key: 'last_name', label: 'Last Name', width: '150px' },
    { key: 'email', label: 'Email', width: '200px' },
    { key: 'phone', label: 'Phone', width: '120px' },
    {
      key: 'created_at',
      label: 'Added',
      width: '120px',
      render: (v) => new Date(v).toLocaleDateString(),
    },
  ];

  if (loading) return <div className="p-4">Loading leads...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  return (
    <EnterpriseTable
      columns={columns}
      data={leads}
      rowKey={(row) => row.id}
      onRowClick={(row) => console.log('Selected:', row)}
      emptyState={
        <p className="text-center py-8 text-gray-500">No leads found</p>
      }
    />
  );
}
