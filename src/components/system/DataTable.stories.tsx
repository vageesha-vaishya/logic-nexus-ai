import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { DataTable, ColumnDef } from '@/components/system/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';

const meta: Meta<typeof DataTable> = {
  title: 'System/DataTable',
  component: DataTable,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof DataTable>;

interface Lead {
  id: string;
  name: string;
  value: number;
  score: number;
  status: string;
  company: string;
  email: string;
}

const mockData: Lead[] = [
  { id: '1', name: 'John Doe', value: 50000, score: 85, status: 'New', company: 'Acme Logistics', email: 'john.doe@acme.corp' },
  { id: '2', name: 'Jane Smith', value: 120000, score: 65, status: 'Negotiation', company: 'Global Trade Inc', email: 'jane@global.trade' },
  { id: '3', name: 'Robert Johnson', value: 250000, score: 95, status: 'Won', company: 'FastShip Delivery', email: 'rob@fastship.com' },
  { id: '4', name: 'Emily Davis', value: 15000, score: 45, status: 'Contacted', company: 'Tech Solutions', email: 'emily@tech.solutions' },
  { id: '5', name: 'Michael Brown', value: 0, score: 20, status: 'Lost', company: 'Import Export Co', email: 'm.brown@import.export' },
];

const columns: ColumnDef<Lead>[] = [
  { 
    key: 'actions', 
    header: '', 
    width: '50px',
    render: () => <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
  },
  { 
    key: 'value', 
    header: 'Value', 
    sortable: true,
    render: (row) => row.value ? `$${row.value.toLocaleString()}.00` : '-'
  },
  { 
    key: 'score', 
    header: 'Score', 
    sortable: true,
    render: (row) => (
      <div className="flex items-center gap-2">
        <span className="w-6 text-sm font-medium">{row.score}</span>
        <div className="h-2 w-16 rounded-full bg-secondary overflow-hidden">
          <div 
            className={`h-full ${row.score > 80 ? 'bg-green-500' : row.score > 50 ? 'bg-yellow-500' : 'bg-red-500'}`} 
            style={{ width: `${row.score}%` }} 
          />
        </div>
      </div>
    )
  },
  { 
    key: 'status', 
    header: 'Status', 
    sortable: true,
    render: (row) => <Badge variant="secondary">{row.status}</Badge>
  },
  { 
    key: 'company', 
    header: 'Company', 
    sortable: true, 
  },
  { 
    key: 'name', 
    header: 'Name', 
    sortable: true,
    render: (row) => (
      <div>
        <div className="font-medium">{row.name}</div>
        <div className="text-xs text-muted-foreground">{row.email}</div>
      </div>
    )
  },
];

export const Default: Story = {
  render: function Render() {
    const [selection, setSelection] = React.useState<string[]>([]);
    const [sort, setSort] = React.useState<{ field: string; direction: 'asc' | 'desc' }>({ field: 'name', direction: 'asc' });
    const [query, setQuery] = React.useState('');
    const [page, setPage] = React.useState(1);

    const filteredData = mockData
      .filter(row => 
        row.name.toLowerCase().includes(query.toLowerCase()) || 
        row.company.toLowerCase().includes(query.toLowerCase())
      )
      .sort((a, b) => {
        const aVal = (a as any)[sort.field];
        const bVal = (b as any)[sort.field];
        if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
        return 0;
      });

    return (
      <DataTable 
        data={filteredData} 
        columns={columns}
        pagination={{
          pageIndex: page,
          pageSize: 10,
          totalCount: filteredData.length,
          onPageChange: setPage,
        }}
        sorting={{
          field: sort.field,
          direction: sort.direction,
          onSort: (f) => setSort(s => ({ field: f, direction: s.field === f && s.direction === 'asc' ? 'desc' : 'asc' }))
        }}
        selection={{
          selectedIds: selection,
          onSelectionChange: setSelection,
          rowId: (r) => r.id
        }}
        search={{
          query,
          onQueryChange: setQuery,
          placeholder: "Search leads..."
        }}
      />
    );
  },
};
