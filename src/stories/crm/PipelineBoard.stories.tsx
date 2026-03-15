import React, { useEffect, useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { action } from 'storybook/actions';
import { KanbanBoard, ColumnType } from '@/components/kanban/KanbanBoard';
import { KanbanItem } from '@/components/kanban/KanbanCard';

type LeadPipelineVisualMode = 'reference' | 'compact' | 'high-volume' | 'empty';

type LeadsPipelineStoryProps = {
  visualMode: LeadPipelineVisualMode;
  showWonColumnOnly: boolean;
  showAssignees: boolean;
  currencySymbol: string;
  boardHeight: number;
  freezeInteractions: boolean;
};

const baseColumns: ColumnType[] = [
  { id: 'new', title: 'New', color: 'bg-red-500' },
  { id: 'qualified', title: 'Qualified', color: 'bg-red-500' },
  { id: 'proposition', title: 'Proposition', color: 'bg-red-500' },
  { id: 'won', title: 'Won', color: 'bg-red-500' },
];

const baseItems: KanbanItem[] = [
  { id: 'n1', title: 'Quote for 150 carpets', subtitle: 'Product', status: 'new', priority: 'high', value: 40000 },
  { id: 'n2', title: 'Quote for 12 Tables', subtitle: 'Product', status: 'new', priority: 'medium', value: 40000 },
  { id: 'n3', title: "Chester Reed's opportunity", subtitle: 'SOS Delhi, Chester Reed', status: 'new', priority: 'low', value: 0 },
  { id: 'q1', title: 'Global Solutions: Furnitures', subtitle: 'Design', status: 'qualified', priority: 'high', value: 3800 },
  { id: 'q2', title: 'Quote for 600 Chairs', subtitle: 'Product', status: 'qualified', priority: 'medium', value: 22500 },
  { id: 'q3', title: 'Info about services', subtitle: 'Product', status: 'qualified', priority: 'medium', value: 25000 },
  { id: 'p1', title: 'Modern Open Space', subtitle: 'Information', status: 'proposition', priority: 'high', value: 4500 },
  { id: 'p2', title: 'Office Design and Architecture', subtitle: 'Consulting', status: 'proposition', priority: 'medium', value: 9000 },
  { id: 'p3', title: '5 VP Chairs', subtitle: 'Services', status: 'proposition', priority: 'low', value: 560 },
  { id: 'p4', title: 'Need 20 Desks', subtitle: 'Consulting', status: 'proposition', priority: 'low', value: 60000 },
  { id: 'w1', title: 'Distributor Contract', subtitle: 'Information • Other', status: 'won', priority: 'high', value: 19800 },
];

const assignees = [
  { name: 'Victoria Li', avatarUrl: 'https://i.pravatar.cc/150?u=victoria' },
  { name: 'James Porter', avatarUrl: 'https://i.pravatar.cc/150?u=james' },
  { name: 'Noah Singh', avatarUrl: 'https://i.pravatar.cc/150?u=noah' },
];

function buildItems(mode: LeadPipelineVisualMode, showAssignees: boolean, currencySymbol: string): KanbanItem[] {
  if (mode === 'empty') {
    return [];
  }

  const mapped = baseItems.map((item, index) => ({
    ...item,
    currency: currencySymbol,
    assignee: showAssignees ? assignees[index % assignees.length] : undefined,
    updatedAt: new Date(2026, 2, (index % 25) + 1).toISOString(),
  }));

  if (mode === 'compact') {
    return mapped.filter((item) => item.status !== 'proposition' || Number(item.value) >= 9000);
  }

  if (mode === 'high-volume') {
    const expanded = mapped.flatMap((item, index) => [
      item,
      {
        ...item,
        id: `${item.id}-hv`,
        title: `${item.title} #${index + 1}`,
        value: Number(item.value || 0) + (index + 1) * 700,
      },
    ]);
    return expanded;
  }

  return mapped;
}

function formatValue(value: number, currencySymbol: string): string {
  return `${value.toLocaleString('en-US')}${currencySymbol}`;
}

function LeadsPipelineStory(props: LeadsPipelineStoryProps) {
  const columns = useMemo(
    () => (props.showWonColumnOnly ? baseColumns.filter((column) => column.id === 'won') : baseColumns),
    [props.showWonColumnOnly],
  );

  const seededItems = useMemo(
    () => buildItems(props.visualMode, props.showAssignees, props.currencySymbol),
    [props.visualMode, props.showAssignees, props.currencySymbol],
  );

  const [items, setItems] = useState<KanbanItem[]>(seededItems);

  useEffect(() => {
    setItems(seededItems);
  }, [seededItems]);

  const totalsByColumn = useMemo(() => {
    return columns.reduce<Record<string, number>>((acc, column) => {
      acc[column.id] = items
        .filter((item) => item.status === column.id)
        .reduce((sum, item) => sum + Number(item.value || 0), 0);
      return acc;
    }, {});
  }, [columns, items]);

  const handleDragEnd = (activeId: string, overId: string, newStatus: string) => {
    if (props.freezeInteractions) {
      action('pipeline.dragBlocked')({ activeId, overId, newStatus });
      return;
    }
    action('pipeline.dragEnd')({ activeId, overId, newStatus });
    setItems((prev) => prev.map((item) => (item.id === activeId ? { ...item, status: newStatus } : item)));
  };

  const handleItemUpdate = async (id: string, updates: Partial<KanbanItem>) => {
    if (props.freezeInteractions) {
      action('pipeline.itemUpdateBlocked')({ id, updates });
      return;
    }
    action('pipeline.itemUpdate')({ id, updates });
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const handleItemClick = (id: string) => {
    if (props.freezeInteractions) {
      action('pipeline.itemClickBlocked')({ id });
      return;
    }
    action('pipeline.itemClick')({ id });
  };

  return (
    <div className="bg-white p-4 md:p-6" style={{ minHeight: `${props.boardHeight + 120}px` }}>
      <div className="mb-4 grid gap-3 grid-cols-2 md:grid-cols-4">
        {columns.map((column) => (
          <div key={column.id} className="rounded-md border border-border bg-card p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-semibold">{column.title}</span>
              <span className="text-sm font-semibold tabular-nums">{formatValue(totalsByColumn[column.id] || 0, props.currencySymbol)}</span>
            </div>
            <div className="h-1 w-full rounded-full bg-red-500/80" />
          </div>
        ))}
      </div>
      <div
        className={`overflow-hidden rounded-lg border bg-muted/20 p-2 ${props.freezeInteractions ? 'pointer-events-none' : ''}`}
        style={{ height: `${props.boardHeight}px` }}
      >
        <KanbanBoard
          columns={columns}
          items={items}
          onDragEnd={handleDragEnd}
          onItemUpdate={handleItemUpdate}
          onItemClick={handleItemClick}
        />
      </div>
    </div>
  );
}

const meta: Meta<typeof LeadsPipelineStory> = {
  title: 'Leads/Pipeline Module',
  component: LeadsPipelineStory,
  tags: ['autodocs'],
  args: {
    visualMode: 'reference',
    showWonColumnOnly: false,
    showAssignees: true,
    currencySymbol: ' €',
    boardHeight: 620,
    freezeInteractions: false,
  },
  argTypes: {
    visualMode: {
      control: 'select',
      options: ['reference', 'compact', 'high-volume', 'empty'],
      description: 'Select visual density and scenario for stakeholder review.',
    },
    showWonColumnOnly: {
      control: 'boolean',
      description: 'Focus on closed outcomes by showing only the Won stage.',
    },
    showAssignees: {
      control: 'boolean',
      description: 'Toggle avatar rendering on cards.',
    },
    currencySymbol: {
      control: 'text',
      description: 'Currency suffix used in stage totals and card values.',
    },
    boardHeight: {
      control: { type: 'range', min: 420, max: 900, step: 20 },
      description: 'Board canvas height for responsive previews.',
    },
    freezeInteractions: {
      control: 'boolean',
      description: 'Disable drag, click, and edit interactions for static review sessions.',
    },
  },
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-background text-foreground">
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    viewport: {
      defaultViewport: 'desktop',
    },
    controls: {
      expanded: true,
      sort: 'requiredFirst',
    },
    a11y: {
      disable: false,
    },
    docs: {
      description: {
        component:
          'Leads pipeline visual reference for stakeholder validation. Integration points: map lead records from `PipelineService.listLeads` into `KanbanItem`, pass stage metadata as `ColumnType[]`, persist drag transitions through `PipelineService.transitionLeadStage`, and route card selection to `/dashboard/leads/:id`.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof LeadsPipelineStory>;

export const ScreenshotReference: Story = {};

export const StakeholderReview: Story = {
  args: {
    visualMode: 'reference',
    showWonColumnOnly: false,
    showAssignees: true,
    currencySymbol: ' €',
    boardHeight: 620,
    freezeInteractions: true,
  },
  parameters: {
    controls: {
      include: ['showWonColumnOnly', 'showAssignees', 'currencySymbol', 'boardHeight'],
    },
    docs: {
      description: {
        story:
          'Demo-safe view for stakeholder sign-off. Interactions are frozen while still allowing visual and responsive validation.',
      },
    },
  },
};

export const CompactView: Story = {
  args: {
    visualMode: 'compact',
    boardHeight: 560,
  },
};

export const HighVolumePipeline: Story = {
  args: {
    visualMode: 'high-volume',
    boardHeight: 700,
  },
};

export const EmptyState: Story = {
  args: {
    visualMode: 'empty',
  },
};

export const MobileReview: Story = {
  args: {
    visualMode: 'compact',
    showAssignees: false,
    boardHeight: 520,
  },
  globals: {
    viewport: {
      value: 'small',
      isRotated: false
    }
  },
};

export const TabletReview: Story = {
  args: {
    visualMode: 'reference',
    boardHeight: 620,
  },
  globals: {
    viewport: {
      value: 'tablet',
      isRotated: false
    }
  },
};
