import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { EnterpriseTable, EnterpriseCard } from './index';
import { CheckCircle, Settings, Trash2, Edit2 } from 'lucide-react';

// ============================================================================
// ENTERPRISE TABLE STORIES
// ============================================================================

const tableMeta: Meta<typeof EnterpriseTable> = {
  title: 'Enterprise/Table',
  component: EnterpriseTable,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default tableMeta;

// Sample data for table stories
interface Account {
  id: string;
  name: string;
  type: string;
  revenue: number;
  status: string;
}

const mockAccounts: Account[] = [
  {
    id: '1',
    name: 'Acme Corporation',
    type: 'Enterprise',
    revenue: 5000000,
    status: 'Active',
  },
  {
    id: '2',
    name: 'TechFlow Inc',
    type: 'Mid-Market',
    revenue: 1200000,
    status: 'Active',
  },
  {
    id: '3',
    name: 'Global Logistics',
    type: 'Enterprise',
    revenue: 3500000,
    status: 'Inactive',
  },
  {
    id: '4',
    name: 'StartUp Labs',
    type: 'SMB',
    revenue: 250000,
    status: 'Active',
  },
];

export const TableBasic: StoryObj<typeof EnterpriseTable> = {
  render: () => (
    <EnterpriseTable
      columns={[
        {
          key: 'name',
          label: 'Account Name',
          sortable: true,
          width: '35%',
        },
        {
          key: 'type',
          label: 'Account Type',
          sortable: true,
          width: '20%',
        },
        {
          key: 'revenue',
          label: 'Annual Revenue',
          sortable: true,
          width: '25%',
          render: (value) => `$${(value / 1000000).toFixed(1)}M`,
        },
        {
          key: 'status',
          label: 'Status',
          sortable: false,
          width: '20%',
        },
      ]}
      data={mockAccounts}
      rowKey={(row) => row.id}
    />
  ),
};

const TableWithSortingComponent = () => {
    const [sortBy, setSortBy] = useState<string>('name');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    return (
      <EnterpriseTable
        columns={[
          {
            key: 'name',
            label: 'Account Name',
            sortable: true,
            width: '35%',
          },
          {
            key: 'type',
            label: 'Account Type',
            sortable: true,
            width: '20%',
          },
          {
            key: 'revenue',
            label: 'Annual Revenue',
            sortable: true,
            width: '25%',
            render: (value) => `$${(value / 1000000).toFixed(1)}M`,
          },
          {
            key: 'status',
            label: 'Status',
            sortable: false,
            width: '20%',
          },
        ]}
        data={mockAccounts}
        rowKey={(row) => row.id}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={(key, order) => {
          setSortBy(key);
          setSortOrder(order);
        }}
      />
    );
};

export const TableWithSorting: StoryObj<typeof EnterpriseTable> = {
  render: () => <TableWithSortingComponent />,
};

export const TableLoading: StoryObj<typeof EnterpriseTable> = {
  render: () => (
    <EnterpriseTable
      columns={[
        {
          key: 'name',
          label: 'Account Name',
          sortable: true,
          width: '35%',
        },
        {
          key: 'type',
          label: 'Account Type',
          sortable: true,
          width: '20%',
        },
        {
          key: 'revenue',
          label: 'Annual Revenue',
          sortable: true,
          width: '25%',
        },
        {
          key: 'status',
          label: 'Status',
          sortable: false,
          width: '20%',
        },
      ]}
      data={[]}
      isLoading={true}
    />
  ),
};

export const TableEmptyState: StoryObj<typeof EnterpriseTable> = {
  render: () => (
    <EnterpriseTable
      columns={[
        {
          key: 'name',
          label: 'Account Name',
          sortable: true,
        },
        {
          key: 'type',
          label: 'Account Type',
          sortable: true,
        },
        {
          key: 'revenue',
          label: 'Annual Revenue',
          sortable: true,
        },
        {
          key: 'status',
          label: 'Status',
          sortable: false,
        },
      ]}
      data={[]}
      emptyState={
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-2">No accounts found</p>
          <p className="text-xs text-gray-400">Create a new account to get started</p>
        </div>
      }
    />
  ),
};

export const TableStriped: StoryObj<typeof EnterpriseTable> = {
  render: () => (
    <EnterpriseTable
      columns={[
        {
          key: 'name',
          label: 'Account Name',
          sortable: true,
        },
        {
          key: 'type',
          label: 'Account Type',
          sortable: true,
        },
        {
          key: 'revenue',
          label: 'Annual Revenue',
          sortable: true,
          render: (value) => `$${(value / 1000000).toFixed(1)}M`,
        },
        {
          key: 'status',
          label: 'Status',
          sortable: false,
        },
      ]}
      data={mockAccounts}
      rowKey={(row) => row.id}
      striped={true}
      hover={true}
    />
  ),
};

export const TableNoStriped: StoryObj<typeof EnterpriseTable> = {
  render: () => (
    <EnterpriseTable
      columns={[
        {
          key: 'name',
          label: 'Account Name',
          sortable: true,
        },
        {
          key: 'type',
          label: 'Account Type',
          sortable: true,
        },
        {
          key: 'revenue',
          label: 'Annual Revenue',
          sortable: true,
          render: (value) => `$${(value / 1000000).toFixed(1)}M`,
        },
        {
          key: 'status',
          label: 'Status',
          sortable: false,
        },
      ]}
      data={mockAccounts}
      rowKey={(row) => row.id}
      striped={false}
      hover={false}
    />
  ),
};

const TableWithRowClickComponent = () => {
    const [selectedRow, setSelectedRow] = useState<Account | null>(null);

    return (
      <div className="space-y-4">
        <EnterpriseTable
          columns={[
            {
              key: 'name',
              label: 'Account Name',
              sortable: true,
            },
            {
              key: 'type',
              label: 'Account Type',
              sortable: true,
            },
            {
              key: 'revenue',
              label: 'Annual Revenue',
              sortable: true,
              render: (value) => `$${(value / 1000000).toFixed(1)}M`,
            },
            {
              key: 'status',
              label: 'Status',
              sortable: false,
            },
          ]}
          data={mockAccounts}
          rowKey={(row) => row.id}
          onRowClick={(row) => setSelectedRow(row)}
        />
        {selectedRow && (
          <div className="p-4 border border-gray-200 rounded-lg bg-blue-50">
            <p className="text-sm font-medium">Selected: {selectedRow.name}</p>
          </div>
        )}
      </div>
    );
};

export const TableWithRowClick: StoryObj<typeof EnterpriseTable> = {
  render: () => <TableWithRowClickComponent />,
};

// ============================================================================
// ENTERPRISE CARD STORIES
// ============================================================================

const cardMeta: Meta<typeof EnterpriseCard> = {
  title: 'Enterprise/Card',
  component: EnterpriseCard,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

type CardStory = StoryObj<typeof EnterpriseCard>;

export const CardDefault: CardStory = {
  render: () => (
    <EnterpriseCard variant="default">
      <p className="text-sm text-gray-600">
        This is a default card with simple content and a subtle shadow.
      </p>
    </EnterpriseCard>
  ),
};

export const CardWithHeader: CardStory = {
  render: () => (
    <EnterpriseCard
      title="Account Overview"
      description="Key metrics and status"
      icon={<Settings className="w-5 h-5" />}
      variant="default"
    >
      <p className="text-sm text-gray-600">
        Display important account information and metrics.
      </p>
    </EnterpriseCard>
  ),
};

export const CardWithActions: CardStory = {
  render: () => (
    <EnterpriseCard
      title="Quick Actions"
      description="Common operations"
      actions={
        <div className="flex gap-2">
          <button className="p-1 hover:bg-gray-200 rounded">
            <Edit2 className="w-4 h-4 text-gray-600" />
          </button>
          <button className="p-1 hover:bg-gray-200 rounded">
            <Trash2 className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      }
      variant="default"
    >
      <p className="text-sm text-gray-600">
        Card with action buttons in the header.
      </p>
    </EnterpriseCard>
  ),
};

export const CardWithFooter: CardStory = {
  render: () => (
    <EnterpriseCard
      title="Status Report"
      description="Current status"
      variant="default"
      footer={
        <div className="text-xs text-gray-500">
          Last updated: 2 hours ago
        </div>
      }
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-sm">All systems operational</span>
        </div>
      </div>
    </EnterpriseCard>
  ),
};

export const CardOutlined: CardStory = {
  render: () => (
    <EnterpriseCard
      title="Outlined Card"
      description="Minimal styling"
      variant="outlined"
    >
      <p className="text-sm text-gray-600">
        This is an outlined card with minimal styling.
      </p>
    </EnterpriseCard>
  ),
};

export const CardElevated: CardStory = {
  render: () => (
    <EnterpriseCard
      title="Elevated Card"
      description="Enhanced shadow"
      variant="elevated"
    >
      <p className="text-sm text-gray-600">
        This card has an elevated appearance with a stronger shadow.
      </p>
    </EnterpriseCard>
  ),
};

const CardClickableComponent = () => {
    const [clicked, setClicked] = useState(false);

    return (
      <EnterpriseCard
        title="Clickable Card"
        clickable={true}
        onClick={() => setClicked(!clicked)}
        className={clicked ? 'border-blue-500' : ''}
      >
        <p className="text-sm text-gray-600">
          Click this card to interact with it
        </p>
        {clicked && (
          <p className="text-xs text-blue-600 mt-3">Card was clicked!</p>
        )}
      </EnterpriseCard>
    );
};

export const CardClickable: CardStory = {
  render: () => <CardClickableComponent />,
};
