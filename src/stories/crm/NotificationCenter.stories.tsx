import type { Meta, StoryObj } from '@storybook/react';
import { NotificationCenter, NotificationItem } from '../../components/crm/NotificationCenter';
import { SkeletonCards } from '@/components/ui/skeleton-table';
import { EmptyState, emptyStates } from '@/components/ui/empty-state';

const meta: Meta<typeof NotificationCenter> = {
  title: 'CRM/NotificationCenter',
  component: NotificationCenter,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Notification Center with tabs, mark-as-read, dismiss actions, and responsive list.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    onMarkRead: { action: 'mark-read' },
    onDismiss: { action: 'dismiss' },
  },
};

export default meta;
type Story = StoryObj<typeof NotificationCenter>;

const notifications: NotificationItem[] = [
  { id: 'n1', type: 'activity', title: 'New lead assigned', description: 'You have been assigned lead Acme Logistics', created_at: new Date().toISOString(), read: false },
  { id: 'n2', type: 'system', title: 'Maintenance window', description: 'System will be unavailable Sunday 2-4am UTC', created_at: new Date().toISOString(), read: true },
  { id: 'n3', type: 'alert', title: 'High priority ticket', description: 'Customer reported a shipment delay', created_at: new Date().toISOString(), read: false },
];

export const Default: Story = {
  args: {
    notifications,
    className: 'w-[600px]',
  },
};

export const Empty: Story = {
  args: {
    notifications: [],
    className: 'w-[600px]',
  },
};

export const Loading: Story = {
  render: () => (
    <div className="w-[600px] p-6">
      <SkeletonCards count={3} />
    </div>
  ),
};

export const Error: Story = {
  render: () => (
    <div className="w-[600px] p-6">
      <EmptyState {...emptyStates.error('Failed to load notifications')} />
    </div>
  ),
};

export const RTL: Story = {
  render: () => (
    <div dir="rtl" className="w-[600px]">
      <NotificationCenter notifications={notifications} />
    </div>
  ),
};

