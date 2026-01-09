import type { Meta, StoryObj } from '@storybook/react';
import { InteractionTimeline, Activity } from '../../components/crm/InteractionTimeline';
import { mockActivities } from './mock-data';
import { SkeletonCards } from '@/components/ui/skeleton-table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const meta: Meta<typeof InteractionTimeline> = {
  title: 'CRM/InteractionTimeline',
  component: InteractionTimeline,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A vertical timeline component for tracking interactions (calls, emails, meetings) with leads and customers. Features collapsible details, activity types, and user attribution.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    onAddActivity: { action: 'add-activity' },
  },
};

export default meta;
type Story = StoryObj<typeof InteractionTimeline>;

const typedMockActivities: Activity[] = mockActivities.map(a => ({
  ...a,
  type: a.type as Activity['type']
}));

export const Default: Story = {
  args: {
    activities: typedMockActivities,
    className: 'w-[600px]',
  },
};

export const Empty: Story = {
  args: {
    activities: [],
    className: 'w-[600px]',
  },
};

export const WithMixedTypes: Story = {
  args: {
    activities: [
      ...typedMockActivities,
      {
        id: 'a4',
        type: 'status_change',
        title: 'Stage Changed',
        description: 'Moved from "New" to "Qualification"',
        date: new Date().toISOString(),
        user: { name: 'System' },
        outcome: 'promoted'
      },
      {
        id: 'a5',
        type: 'note',
        title: 'Internal Note',
        description: 'Client mentioned they are evaluating 2 other competitors. Need to emphasize our global coverage.',
        date: new Date().toISOString(),
        user: { name: 'Sarah Wilson', avatar: 'https://i.pravatar.cc/150?u=u1' },
      }
    ],
    className: 'w-[600px]',
  },
};

export const Loading: Story = {
  render: (args) => (
    <div className="w-[600px]">
      <SkeletonCards count={3} />
    </div>
  ),
};

export const Error: Story = {
  render: (args) => (
    <div className="w-[600px]">
      <Alert variant="destructive">
        <AlertTitle>Failed to load activities</AlertTitle>
        <AlertDescription>We encountered an error fetching interaction history. Please retry.</AlertDescription>
      </Alert>
    </div>
  ),
};

export const RTL: Story = {
  render: (args) => (
    <div dir="rtl" className="w-[600px]">
      <InteractionTimeline {...args} activities={typedMockActivities} />
    </div>
  ),
};
