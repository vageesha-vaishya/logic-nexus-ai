import type { Meta, StoryObj } from '@storybook/react';
import { TeamAssignment, TeamMember } from '../../components/crm/TeamAssignment';
import { mockUsers } from './mock-data';
import { EmptyState, emptyStates } from '@/components/ui/empty-state';
import { SkeletonCards } from '@/components/ui/skeleton-table';

const meta: Meta<typeof TeamAssignment> = {
  title: 'CRM/TeamAssignment',
  component: TeamAssignment,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A team management component for assigning roles and access levels to users within a CRM context.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    onAddMember: { action: 'add-member' },
    onUpdateAccess: { action: 'update-access' },
    onRemoveMember: { action: 'remove-member' },
  },
};

export default meta;
type Story = StoryObj<typeof TeamAssignment>;

const mockMembers: TeamMember[] = [
  {
    ...mockUsers[0],
    accessLevel: 'owner'
  } as TeamMember,
  {
    ...mockUsers[1],
    accessLevel: 'editor'
  } as TeamMember,
  {
    ...mockUsers[2],
    accessLevel: 'viewer'
  } as TeamMember,
];

export const Default: Story = {
  args: {
    members: mockMembers,
    className: 'w-[600px]',
  },
};

export const SingleMember: Story = {
  args: {
    members: [mockMembers[0]],
    className: 'w-[600px]',
  },
};

export const Loading: Story = {
  render: () => (
    <div className="w-[600px] p-4">
      <SkeletonCards count={2} />
    </div>
  ),
};

export const Empty: Story = {
  render: () => (
    <div className="w-[600px] p-4">
      <EmptyState {...emptyStates.noItems('Team Member')} />
    </div>
  ),
};

export const RTL: Story = {
  render: () => (
    <div dir="rtl" className="w-[600px]">
      <TeamAssignment members={mockMembers} />
    </div>
  ),
};
