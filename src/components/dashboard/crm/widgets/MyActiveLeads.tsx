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

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const { data } = await scopedDb
          .from('contacts')
          .select('id, first_name, last_name, email, phone, created_at')
          .limit(10);
        setLeads(data || []);
      } catch (error) {
        console.error('Failed to fetch leads:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();
  }, [scopedDb]);

  const columns: Column<Contact>[] = [
    { key: 'first_name', label: 'Name', width: '150px' },
    { key: 'email', label: 'Email', width: '200px' },
    { key: 'phone', label: 'Phone', width: '120px' },
    { key: 'created_at', label: 'Added', width: '120px', render: (v) => new Date(v).toLocaleDateString() },
  ];

  if (loading) return <div>Loading leads...</div>;

  return (
    <EnterpriseTable
      columns={columns}
      data={leads}
      rowKey={(row) => row.id}
      emptyState={<p className="text-center py-8 text-gray-500">No leads found</p>}
    />
  );
}
