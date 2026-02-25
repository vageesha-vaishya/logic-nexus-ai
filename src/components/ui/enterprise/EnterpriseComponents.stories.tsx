import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import {
  EnterpriseTable,
  EnterpriseCard,
  EnterpriseHeader,
  EnterpriseButton,
  EnterpriseModal,
  EnterpriseForm,
  EnterpriseFormSection,
  EnterpriseFormRow,
  EnterpriseFormField,
} from './index';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, AlertCircle, Settings, Plus, Trash2, Edit2, Mail, Phone, MapPin } from 'lucide-react';

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

export const TableWithSorting: StoryObj<typeof EnterpriseTable> = {
  render: () => {
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
  },
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

export const TableWithRowClick: StoryObj<typeof EnterpriseTable> = {
  render: () => {
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
  },
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

export const CardClickable: CardStory = {
  render: () => {
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
  },
};

// ============================================================================
// ENTERPRISE HEADER STORIES
// ============================================================================

const headerMeta: Meta<typeof EnterpriseHeader> = {
  title: 'Enterprise/Header',
  component: EnterpriseHeader,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

type HeaderStory = StoryObj<typeof EnterpriseHeader>;

export const HeaderDefault: HeaderStory = {
  render: () => (
    <EnterpriseHeader
      title="Acme Corporation"
      icon={<Settings className="w-6 h-6 text-gray-600" />}
      variant="default"
    />
  ),
};

export const HeaderWithSubtitle: HeaderStory = {
  render: () => (
    <EnterpriseHeader
      title="Account Details"
      subtitle="Acme Corporation"
      description="Enterprise account with full service package"
      icon={<Settings className="w-6 h-6 text-gray-600" />}
      variant="default"
    />
  ),
};

export const HeaderWithStatus: HeaderStory = {
  render: () => (
    <EnterpriseHeader
      title="Account Status"
      subtitle="Acme Corporation"
      icon={<Settings className="w-6 h-6 text-gray-600" />}
      status={
        <div className="flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-200 rounded-full">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-xs font-medium text-green-700">Active</span>
        </div>
      }
      variant="default"
    />
  ),
};

export const HeaderWithActions: HeaderStory = {
  render: () => (
    <EnterpriseHeader
      title="Account Dashboard"
      subtitle="Acme Corporation"
      icon={<Settings className="w-6 h-6 text-gray-600" />}
      actions={
        <div className="flex gap-2">
          <button className="px-3 py-2 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50">
            Edit
          </button>
          <button className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
            Save
          </button>
        </div>
      }
      variant="default"
    />
  ),
};

export const HeaderCompact: HeaderStory = {
  render: () => (
    <EnterpriseHeader
      title="Compact Header"
      subtitle="Sub heading"
      variant="compact"
    />
  ),
};

export const HeaderLarge: HeaderStory = {
  render: () => (
    <EnterpriseHeader
      title="Large Header"
      subtitle="Sub heading"
      description="With full description and plenty of space"
      variant="large"
    />
  ),
};

// ============================================================================
// ENTERPRISE BUTTON STORIES
// ============================================================================

const buttonMeta: Meta<typeof EnterpriseButton> = {
  title: 'Enterprise/Button',
  component: EnterpriseButton,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

type ButtonStory = StoryObj<typeof EnterpriseButton>;

export const ButtonPrimary: ButtonStory = {
  render: () => <EnterpriseButton variant="primary">Primary Button</EnterpriseButton>,
};

export const ButtonSecondary: ButtonStory = {
  render: () => <EnterpriseButton variant="secondary">Secondary Button</EnterpriseButton>,
};

export const ButtonDestructive: ButtonStory = {
  render: () => <EnterpriseButton variant="destructive">Delete</EnterpriseButton>,
};

export const ButtonGhost: ButtonStory = {
  render: () => <EnterpriseButton variant="ghost">Ghost Button</EnterpriseButton>,
};

export const ButtonOutline: ButtonStory = {
  render: () => <EnterpriseButton variant="outline">Outline Button</EnterpriseButton>,
};

export const ButtonSmall: ButtonStory = {
  render: () => (
    <EnterpriseButton variant="primary" size="sm">
      Small Button
    </EnterpriseButton>
  ),
};

export const ButtonMedium: ButtonStory = {
  render: () => (
    <EnterpriseButton variant="primary" size="md">
      Medium Button
    </EnterpriseButton>
  ),
};

export const ButtonLarge: ButtonStory = {
  render: () => (
    <EnterpriseButton variant="primary" size="lg">
      Large Button
    </EnterpriseButton>
  ),
};

export const ButtonWithIconLeft: ButtonStory = {
  render: () => (
    <EnterpriseButton variant="primary" icon={<Plus className="w-4 h-4" />} iconPosition="left">
      Add New
    </EnterpriseButton>
  ),
};

export const ButtonWithIconRight: ButtonStory = {
  render: () => (
    <EnterpriseButton variant="primary" icon={<Plus className="w-4 h-4" />} iconPosition="right">
      Add New
    </EnterpriseButton>
  ),
};

export const ButtonLoading: ButtonStory = {
  render: () => (
    <EnterpriseButton variant="primary" loading={true}>
      Processing
    </EnterpriseButton>
  ),
};

export const ButtonDisabled: ButtonStory = {
  render: () => (
    <EnterpriseButton variant="primary" disabled={true}>
      Disabled
    </EnterpriseButton>
  ),
};

export const ButtonAllVariants: ButtonStory = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <EnterpriseButton variant="primary">Primary</EnterpriseButton>
      <EnterpriseButton variant="secondary">Secondary</EnterpriseButton>
      <EnterpriseButton variant="destructive">Destructive</EnterpriseButton>
      <EnterpriseButton variant="ghost">Ghost</EnterpriseButton>
      <EnterpriseButton variant="outline">Outline</EnterpriseButton>
    </div>
  ),
};

export const ButtonAllSizes: ButtonStory = {
  render: () => (
    <div className="flex flex-wrap gap-3 items-center">
      <EnterpriseButton variant="primary" size="sm">
        Small
      </EnterpriseButton>
      <EnterpriseButton variant="primary" size="md">
        Medium
      </EnterpriseButton>
      <EnterpriseButton variant="primary" size="lg">
        Large
      </EnterpriseButton>
    </div>
  ),
};

// ============================================================================
// ENTERPRISE MODAL STORIES
// ============================================================================

const modalMeta: Meta<typeof EnterpriseModal> = {
  title: 'Enterprise/Modal',
  component: EnterpriseModal,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

type ModalStory = StoryObj<typeof EnterpriseModal>;

export const ModalSmall: ModalStory = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true);

    return (
      <>
        <EnterpriseButton onClick={() => setIsOpen(true)}>
          Open Small Modal
        </EnterpriseButton>
        <EnterpriseModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title="Confirm Action"
          size="sm"
        >
          <p className="text-sm text-gray-600">
            Are you sure you want to proceed with this action?
          </p>
        </EnterpriseModal>
      </>
    );
  },
};

export const ModalMedium: ModalStory = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true);

    return (
      <>
        <EnterpriseButton onClick={() => setIsOpen(true)}>
          Open Medium Modal
        </EnterpriseButton>
        <EnterpriseModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title="Create New Account"
          description="Fill in the details below to create a new account"
          size="md"
        >
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Account Name</label>
              <Input placeholder="Enter account name" />
            </div>
            <div>
              <label className="text-sm font-medium">Type</label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                  <SelectItem value="mid-market">Mid-Market</SelectItem>
                  <SelectItem value="smb">SMB</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </EnterpriseModal>
      </>
    );
  },
};

export const ModalLarge: ModalStory = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true);

    return (
      <>
        <EnterpriseButton onClick={() => setIsOpen(true)}>
          Open Large Modal
        </EnterpriseButton>
        <EnterpriseModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title="Account Details"
          description="View and edit all account information"
          size="lg"
        >
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Company Name</label>
                <Input placeholder="Enter company name" />
              </div>
              <div>
                <label className="text-sm font-medium">Industry</label>
                <Input placeholder="Enter industry" />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input placeholder="Enter email" />
              </div>
              <div>
                <label className="text-sm font-medium">Phone</label>
                <Input placeholder="Enter phone" />
              </div>
            </div>
          </div>
        </EnterpriseModal>
      </>
    );
  },
};

export const ModalExtraLarge: ModalStory = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true);

    return (
      <>
        <EnterpriseButton onClick={() => setIsOpen(true)}>
          Open XL Modal
        </EnterpriseButton>
        <EnterpriseModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title="Comprehensive Form"
          size="xl"
        >
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">First Name</label>
                <Input placeholder="Enter first name" />
              </div>
              <div>
                <label className="text-sm font-medium">Last Name</label>
                <Input placeholder="Enter last name" />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input placeholder="Enter email" />
              </div>
              <div>
                <label className="text-sm font-medium">Phone</label>
                <Input placeholder="Enter phone" />
              </div>
              <div>
                <label className="text-sm font-medium">Company</label>
                <Input placeholder="Enter company" />
              </div>
              <div>
                <label className="text-sm font-medium">Position</label>
                <Input placeholder="Enter position" />
              </div>
            </div>
          </div>
        </EnterpriseModal>
      </>
    );
  },
};

export const ModalWithFooter: ModalStory = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true);

    return (
      <>
        <EnterpriseButton onClick={() => setIsOpen(true)}>
          Open Modal with Footer
        </EnterpriseButton>
        <EnterpriseModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title="Confirm Changes"
          description="Are you sure you want to save these changes?"
          size="md"
          footer={
            <div className="flex gap-3 justify-end">
              <EnterpriseButton
                variant="outline"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </EnterpriseButton>
              <EnterpriseButton
                variant="primary"
                onClick={() => setIsOpen(false)}
              >
                Save Changes
              </EnterpriseButton>
            </div>
          }
        >
          <p className="text-sm text-gray-600">
            All changes will be saved and cannot be undone.
          </p>
        </EnterpriseModal>
      </>
    );
  },
};

// ============================================================================
// ENTERPRISE FORM STORIES
// ============================================================================

const formMeta: Meta<typeof EnterpriseForm> = {
  title: 'Enterprise/Form',
  component: EnterpriseForm,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

type FormStory = StoryObj<typeof EnterpriseForm>;

export const FormBasic: FormStory = {
  render: () => (
    <EnterpriseForm
      className="max-w-2xl"
      onSubmit={(e) => {
        e.preventDefault();
        alert('Form submitted!');
      }}
    >
      <EnterpriseFormSection
        title="Contact Information"
        description="Enter your contact details"
      >
        <EnterpriseFormField label="Full Name" required>
          <Input placeholder="Enter your full name" />
        </EnterpriseFormField>
        <EnterpriseFormField label="Email" required>
          <Input type="email" placeholder="Enter your email" />
        </EnterpriseFormField>
      </EnterpriseFormSection>

      <div className="flex gap-3 justify-end">
        <EnterpriseButton variant="outline">Cancel</EnterpriseButton>
        <EnterpriseButton variant="primary" type="submit">
          Save
        </EnterpriseButton>
      </div>
    </EnterpriseForm>
  ),
};

export const FormTwoColumn: FormStory = {
  render: () => (
    <EnterpriseForm className="max-w-4xl">
      <EnterpriseFormSection
        title="Account Information"
        description="Basic details about the account"
      >
        <EnterpriseFormRow columns={2}>
          <EnterpriseFormField label="Account Name" required>
            <Input placeholder="Enter account name" />
          </EnterpriseFormField>
          <EnterpriseFormField label="Account Type" required>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="enterprise">Enterprise</SelectItem>
                <SelectItem value="mid-market">Mid-Market</SelectItem>
                <SelectItem value="smb">SMB</SelectItem>
              </SelectContent>
            </Select>
          </EnterpriseFormField>
        </EnterpriseFormRow>

        <EnterpriseFormRow columns={1}>
          <EnterpriseFormField label="Description">
            <Input placeholder="Enter description" />
          </EnterpriseFormField>
        </EnterpriseFormRow>
      </EnterpriseFormSection>

      <div className="flex gap-3 justify-end">
        <EnterpriseButton variant="outline">Cancel</EnterpriseButton>
        <EnterpriseButton variant="primary">Save</EnterpriseButton>
      </div>
    </EnterpriseForm>
  ),
};

export const FormThreeColumn: FormStory = {
  render: () => (
    <EnterpriseForm className="max-w-4xl">
      <EnterpriseFormSection
        title="Contact Details"
        description="Contact information for the account"
      >
        <EnterpriseFormRow columns={3}>
          <EnterpriseFormField label="First Name" required>
            <Input placeholder="Enter first name" />
          </EnterpriseFormField>
          <EnterpriseFormField label="Last Name" required>
            <Input placeholder="Enter last name" />
          </EnterpriseFormField>
          <EnterpriseFormField label="Email" required>
            <Input type="email" placeholder="Enter email" />
          </EnterpriseFormField>
        </EnterpriseFormRow>

        <EnterpriseFormRow columns={3}>
          <EnterpriseFormField label="Phone">
            <Input placeholder="Enter phone" />
          </EnterpriseFormField>
          <EnterpriseFormField label="Title">
            <Input placeholder="Enter title" />
          </EnterpriseFormField>
          <EnterpriseFormField label="Department">
            <Input placeholder="Enter department" />
          </EnterpriseFormField>
        </EnterpriseFormRow>
      </EnterpriseFormSection>

      <div className="flex gap-3 justify-end">
        <EnterpriseButton variant="outline">Cancel</EnterpriseButton>
        <EnterpriseButton variant="primary">Save</EnterpriseButton>
      </div>
    </EnterpriseForm>
  ),
};

export const FormMultipleSections: FormStory = {
  render: () => (
    <EnterpriseForm className="max-w-4xl">
      <EnterpriseFormSection
        title="Company Information"
        description="Details about your company"
      >
        <EnterpriseFormRow columns={2}>
          <EnterpriseFormField label="Company Name" required>
            <Input placeholder="Enter company name" />
          </EnterpriseFormField>
          <EnterpriseFormField label="Industry" required>
            <Input placeholder="Enter industry" />
          </EnterpriseFormField>
        </EnterpriseFormRow>
      </EnterpriseFormSection>

      <EnterpriseFormSection
        title="Contact Information"
        description="Primary contact details"
      >
        <EnterpriseFormRow columns={2}>
          <EnterpriseFormField label="Email" required>
            <Input type="email" placeholder="Enter email" />
          </EnterpriseFormField>
          <EnterpriseFormField label="Phone" required>
            <Input placeholder="Enter phone" />
          </EnterpriseFormField>
        </EnterpriseFormRow>
      </EnterpriseFormSection>

      <EnterpriseFormSection
        title="Address"
        description="Company location"
      >
        <EnterpriseFormRow columns={1}>
          <EnterpriseFormField label="Street Address" required>
            <Input placeholder="Enter street address" />
          </EnterpriseFormField>
        </EnterpriseFormRow>

        <EnterpriseFormRow columns={3}>
          <EnterpriseFormField label="City" required>
            <Input placeholder="Enter city" />
          </EnterpriseFormField>
          <EnterpriseFormField label="State" required>
            <Input placeholder="Enter state" />
          </EnterpriseFormField>
          <EnterpriseFormField label="ZIP Code" required>
            <Input placeholder="Enter ZIP code" />
          </EnterpriseFormField>
        </EnterpriseFormRow>
      </EnterpriseFormSection>

      <div className="flex gap-3 justify-end">
        <EnterpriseButton variant="outline">Cancel</EnterpriseButton>
        <EnterpriseButton variant="primary">Save Changes</EnterpriseButton>
      </div>
    </EnterpriseForm>
  ),
};

export const FormWithValidation: FormStory = {
  render: () => {
    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setErrors({
        email: 'This email is already in use',
        phone: 'Invalid phone number format',
      });
    };

    return (
      <EnterpriseForm className="max-w-2xl" onSubmit={handleSubmit}>
        <EnterpriseFormSection title="Account Details">
          <EnterpriseFormField label="Email" required error={errors.email}>
            <Input
              type="email"
              placeholder="Enter email"
              className={errors.email ? 'border-red-500' : ''}
            />
          </EnterpriseFormField>

          <EnterpriseFormField label="Phone" required error={errors.phone}>
            <Input
              placeholder="Enter phone"
              className={errors.phone ? 'border-red-500' : ''}
            />
          </EnterpriseFormField>

          <EnterpriseFormField
            label="Company Website"
            hint="Optional - include https://"
          >
            <Input placeholder="https://example.com" />
          </EnterpriseFormField>
        </EnterpriseFormSection>

        <div className="flex gap-3 justify-end">
          <EnterpriseButton variant="outline">Cancel</EnterpriseButton>
          <EnterpriseButton variant="primary" type="submit">
            Submit
          </EnterpriseButton>
        </div>
      </EnterpriseForm>
    );
  },
};

export const FormComplex: FormStory = {
  render: () => (
    <EnterpriseForm className="max-w-4xl">
      <EnterpriseFormSection
        title="Personal Information"
        description="Tell us about yourself"
      >
        <EnterpriseFormRow columns={2}>
          <EnterpriseFormField label="First Name" required>
            <Input placeholder="John" />
          </EnterpriseFormField>
          <EnterpriseFormField label="Last Name" required>
            <Input placeholder="Doe" />
          </EnterpriseFormField>
        </EnterpriseFormRow>

        <EnterpriseFormField label="Email" required hint="We'll use this to contact you">
          <Input type="email" placeholder="john@example.com" />
        </EnterpriseFormField>
      </EnterpriseFormSection>

      <EnterpriseFormSection
        title="Professional Details"
        description="Information about your role"
      >
        <EnterpriseFormRow columns={3}>
          <EnterpriseFormField label="Company" required>
            <Input placeholder="Your Company" />
          </EnterpriseFormField>
          <EnterpriseFormField label="Position" required>
            <Input placeholder="Your Position" />
          </EnterpriseFormField>
          <EnterpriseFormField label="Phone">
            <Input placeholder="(555) 123-4567" />
          </EnterpriseFormField>
        </EnterpriseFormRow>

        <EnterpriseFormRow columns={2}>
          <EnterpriseFormField label="Industry" required>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tech">Technology</SelectItem>
                <SelectItem value="finance">Finance</SelectItem>
                <SelectItem value="healthcare">Healthcare</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </EnterpriseFormField>
          <EnterpriseFormField label="Company Size">
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1-10">1-10 employees</SelectItem>
                <SelectItem value="11-50">11-50 employees</SelectItem>
                <SelectItem value="51-200">51-200 employees</SelectItem>
                <SelectItem value="200+">200+ employees</SelectItem>
              </SelectContent>
            </Select>
          </EnterpriseFormField>
        </EnterpriseFormRow>
      </EnterpriseFormSection>

      <EnterpriseFormSection
        title="Address"
        description="Your location information"
      >
        <EnterpriseFormRow columns={1}>
          <EnterpriseFormField label="Street Address" required>
            <Input placeholder="123 Main St" />
          </EnterpriseFormField>
        </EnterpriseFormRow>

        <EnterpriseFormRow columns={3}>
          <EnterpriseFormField label="City" required>
            <Input placeholder="San Francisco" />
          </EnterpriseFormField>
          <EnterpriseFormField label="State/Province" required>
            <Input placeholder="California" />
          </EnterpriseFormField>
          <EnterpriseFormField label="ZIP Code" required>
            <Input placeholder="94102" />
          </EnterpriseFormField>
        </EnterpriseFormRow>
      </EnterpriseFormSection>

      <div className="flex gap-3 justify-end pt-4">
        <EnterpriseButton variant="outline">Cancel</EnterpriseButton>
        <EnterpriseButton variant="primary" type="submit">
          Create Account
        </EnterpriseButton>
      </div>
    </EnterpriseForm>
  ),
};
