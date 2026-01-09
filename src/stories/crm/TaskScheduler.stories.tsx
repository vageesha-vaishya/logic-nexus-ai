import type { Meta, StoryObj } from '@storybook/react';
import { TaskScheduler, Task } from '../../components/crm/TaskScheduler';
import { mockUsers } from './mock-data';
import { addDays, subDays } from 'date-fns';
import { EmptyState, emptyStates } from '@/components/ui/empty-state';
import { SkeletonCards } from '@/components/ui/skeleton-table';

const meta: Meta<typeof TaskScheduler> = {
  title: 'CRM/TaskScheduler',
  component: TaskScheduler,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A task management component with tabs for upcoming, overdue, and completed tasks. Features priority indicators and assignment details.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    onAddTask: { action: 'add-task' },
    onCompleteTask: { action: 'complete-task' },
  },
};

export default meta;
type Story = StoryObj<typeof TaskScheduler>;

const mockTasks: Task[] = [
  {
    id: 't1',
    title: 'Follow up with Acme Logistics',
    due_date: addDays(new Date(), 1).toISOString(),
    status: 'pending',
    priority: 'high',
    assigned_to: mockUsers[0],
    related_to: { type: 'lead', id: 'l1', name: 'Acme Logistics' }
  },
  {
    id: 't2',
    title: 'Prepare Q3 Proposal',
    due_date: new Date().toISOString(),
    status: 'pending',
    priority: 'medium',
    assigned_to: mockUsers[0],
    related_to: { type: 'opportunity', id: 'o1', name: 'Global Trade Expansion' }
  },
  {
    id: 't3',
    title: 'Send contract for review',
    due_date: subDays(new Date(), 2).toISOString(),
    status: 'overdue',
    priority: 'high',
    assigned_to: mockUsers[1],
    related_to: { type: 'lead', id: 'l3', name: 'FastShip Delivery' }
  },
  {
    id: 't4',
    title: 'Update contact details',
    due_date: subDays(new Date(), 5).toISOString(),
    status: 'completed',
    priority: 'low',
    assigned_to: mockUsers[2],
  }
];

export const Default: Story = {
  args: {
    tasks: mockTasks,
    className: 'w-[500px]',
  },
};

export const NoTasks: Story = {
  args: {
    tasks: [],
    className: 'w-[500px]',
  },
};

export const Loading: Story = {
  render: () => (
    <div className="w-[500px] p-4">
      <SkeletonCards count={3} />
    </div>
  ),
};

export const Error: Story = {
  render: () => (
    <div className="w-[500px] p-4">
      <EmptyState {...emptyStates.error('Unable to load tasks')} />
    </div>
  ),
};

export const RTL: Story = {
  render: () => (
    <div dir="rtl" className="w-[500px]">
      <TaskScheduler tasks={mockTasks} />
    </div>
  ),
};
