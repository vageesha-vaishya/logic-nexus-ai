import type { Meta, StoryObj } from '@storybook/react';
import { AdvancedFilter, FilterField } from '../../components/crm/AdvancedFilter';
import { useState } from 'react';
import { SkeletonForm } from '@/components/ui/skeleton-table';
import { EmptyState, emptyStates } from '@/components/ui/empty-state';

const meta: Meta<typeof AdvancedFilter> = {
  title: 'CRM/AdvancedFilter',
  component: AdvancedFilter,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A powerful filtering component supporting multiple criteria, operators, and saved presets. Essential for managing large datasets in CRM views.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AdvancedFilter>;

const filterFields: FilterField[] = [
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'email', label: 'Email', type: 'text' },
  { id: 'value', label: 'Deal Value', type: 'number' },
  { id: 'created_at', label: 'Created Date', type: 'date' },
  { 
    id: 'status', 
    label: 'Status', 
    type: 'select',
    options: [
      { label: 'New', value: 'new' },
      { label: 'Qualified', value: 'qualified' },
      { label: 'Negotiation', value: 'negotiation' },
      { label: 'Won', value: 'won' },
      { label: 'Lost', value: 'lost' },
    ] 
  },
  { 
    id: 'source', 
    label: 'Lead Source', 
    type: 'select',
    options: [
      { label: 'Website', value: 'website' },
      { label: 'Referral', value: 'referral' },
      { label: 'LinkedIn', value: 'linkedin' },
    ] 
  },
];

const RenderWithState = (args: any) => {
  const [presets, setPresets] = useState([
    { 
      id: 'p1', 
      name: 'High Value Leads', 
      conditions: [
        { id: 'c1', fieldId: 'value', operator: 'gt', value: '10000' },
        { id: 'c2', fieldId: 'status', operator: 'is', value: 'new' }
      ] 
    }
  ]);

  return (
    <div className="w-[800px] h-[400px] p-4 border rounded-lg bg-white">
      <AdvancedFilter 
        {...args} 
        savedPresets={presets}
        onSavePreset={(name, conditions) => {
          setPresets([...presets, { id: Math.random().toString(), name, conditions }]);
          args.onSavePreset?.(name, conditions);
        }}
      />
      
      <div className="mt-8 p-4 bg-slate-50 rounded border border-dashed">
        <p className="text-sm text-slate-500 mb-2">Content area would go here...</p>
        <div className="h-32 bg-slate-100 rounded"></div>
      </div>
    </div>
  );
};

export const Default: Story = {
  args: {
    fields: filterFields,
    onApply: (c) => console.log('Filters applied:', c),
    onSavePreset: (n, c) => console.log('Preset saved:', n, c),
  },
  render: RenderWithState,
};

export const Loading: Story = {
  render: () => (
    <div className="w-[800px] p-6">
      <SkeletonForm />
    </div>
  )
};

export const Empty: Story = {
  render: () => (
    <div className="w-[800px] p-6">
      <EmptyState {...emptyStates.noResults()} />
    </div>
  )
};

export const RTL: Story = {
  render: () => (
    <div dir="rtl" className="w-[800px] h-[400px] p-4 border rounded-lg bg-white">
      <AdvancedFilter
        fields={filterFields}
        onApply={(c) => console.log('Filters applied:', c)}
      />
    </div>
  )
};
