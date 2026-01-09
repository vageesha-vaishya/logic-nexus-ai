import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { KanbanBoard, ColumnType } from '@/components/kanban/KanbanBoard';
import { KanbanItem } from '@/components/kanban/KanbanCard';
import { mockLeads } from './mock-data';
import { Lead } from '@/pages/dashboard/leads-data';

// Transform mock leads to Kanban items
const initialItems: KanbanItem[] = mockLeads.map(lead => ({
  id: lead.id,
  title: `${lead.first_name} ${lead.last_name}`,
  subtitle: lead.company || undefined,
  status: lead.status,
  priority: (lead.lead_score && lead.lead_score > 80) ? 'high' : (lead.lead_score && lead.lead_score > 50) ? 'medium' : 'low',
  value: lead.estimated_value || undefined,
  currency: 'USD',
  tags: [lead.source],
  assignee: lead.owner_id ? {
    name: 'User ' + lead.owner_id,
    avatarUrl: `https://i.pravatar.cc/150?u=${lead.owner_id}`
  } : undefined,
  updatedAt: lead.updated_at
}));

const columns: ColumnType[] = [
  { id: 'new', title: 'New', color: 'bg-blue-500/10 text-blue-700' },
  { id: 'contacted', title: 'Contacted', color: 'bg-purple-500/10 text-purple-700' },
  { id: 'negotiation', title: 'Negotiation', color: 'bg-orange-500/10 text-orange-700' },
  { id: 'won', title: 'Won', color: 'bg-green-500/10 text-green-700' },
  { id: 'lost', title: 'Lost', color: 'bg-red-500/10 text-red-700' }
];

const PipelineBoardWrapper = () => {
  const [items, setItems] = useState(initialItems);

  const handleDragEnd = (activeId: string, overId: string, newStatus: string) => {
    setItems((prev) => 
      prev.map(item => 
        item.id === activeId ? { ...item, status: newStatus } : item
      )
    );
  };

  return (
    <div className="h-[600px] p-4 bg-slate-50 overflow-hidden">
      <KanbanBoard 
        columns={columns} 
        items={items} 
        onDragEnd={handleDragEnd}
        className="h-full"
      />
    </div>
  );
};

const meta: Meta<typeof KanbanBoard> = {
  title: 'CRM/Pipeline Board',
  component: KanbanBoard,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof KanbanBoard>;

export const InteractiveBoard: Story = {
  render: () => <PipelineBoardWrapper />
};
