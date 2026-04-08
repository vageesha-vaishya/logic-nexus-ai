import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '@/components/ui/badge';
import {
  AmroInventoryDataGridTemplate,
  type AmroInventoryDataGridTemplateProps,
  type GridColumnDefinition,
} from './AmroInventoryDataGridTemplate';

type InventoryRecord = {
  id: string;
  partNumber: string;
  description: string;
  quantity: number;
  lastUpdated: string;
  serviceable: boolean;
  metadata: {
    aisle: string;
    bin: string;
    tags: string[];
  };
  category: string;
  owner: string;
};

const categories = ['Rotable', 'Consumable', 'Tooling', 'Equipment'];
const owners = ['Stores', 'Line Maintenance', 'Heavy Maintenance', 'Planning'];

const mockRecords: InventoryRecord[] = Array.from({ length: 220 }).map((_, index) => ({
  id: `INV-${String(index + 1).padStart(4, '0')}`,
  partNumber: `PN-${10000 + index}`,
  description: `Hydraulic component ${index + 1}`,
  quantity: Math.max(0, Math.floor(120 - (index % 33) * 2 + (index % 7))),
  lastUpdated: new Date(2026, (index % 12), ((index % 27) + 1)).toISOString(),
  serviceable: index % 5 !== 0,
  metadata: {
    aisle: `A-${(index % 9) + 1}`,
    bin: `B-${(index % 14) + 1}`,
    tags: [index % 2 === 0 ? 'critical' : 'routine', index % 3 === 0 ? 'serialized' : 'bulk'],
  },
  category: categories[index % categories.length],
  owner: owners[index % owners.length],
}));

const columns: GridColumnDefinition<InventoryRecord>[] = [
  { key: 'id', header: 'Record ID', sortable: true, filterable: true, groupable: true, resizable: true, width: 150, dataType: 'text' },
  { key: 'partNumber', header: 'Part Number', sortable: true, filterable: true, groupable: true, resizable: true, width: 150, dataType: 'text' },
  { key: 'description', header: 'Description', sortable: true, filterable: true, resizable: true, width: 230, dataType: 'text' },
  { key: 'quantity', header: 'Qty', sortable: true, filterable: false, groupable: false, resizable: true, width: 90, dataType: 'numeric' },
  { key: 'lastUpdated', header: 'Last Updated', sortable: true, filterable: false, groupable: false, resizable: true, width: 130, dataType: 'date' },
  {
    key: 'serviceable',
    header: 'Serviceable',
    sortable: true,
    filterable: false,
    groupable: true,
    resizable: true,
    width: 120,
    dataType: 'boolean',
    render: (record) => (
      <Badge variant={record.serviceable ? 'default' : 'destructive'}>
        {record.serviceable ? 'Ready' : 'Blocked'}
      </Badge>
    ),
  },
  { key: 'metadata', header: 'Metadata', sortable: false, filterable: true, groupable: false, resizable: true, width: 250, dataType: 'object' },
  { key: 'category', header: 'Category', sortable: true, filterable: true, groupable: true, resizable: true, width: 140, dataType: 'text' },
  { key: 'owner', header: 'Owner', sortable: true, filterable: true, groupable: true, resizable: true, width: 180, dataType: 'text' },
];

const TypedAmroInventoryDataGridTemplate = AmroInventoryDataGridTemplate as React.ComponentType<AmroInventoryDataGridTemplateProps<InventoryRecord>>;

const meta: Meta<typeof TypedAmroInventoryDataGridTemplate> = {
  title: 'AMRO/Templates/AmroInventoryDataGridTemplate',
  component: TypedAmroInventoryDataGridTemplate,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    viewMode: {
      control: 'inline-radio',
      options: ['horizontal-split', 'vertical-split', 'stacked-auto'],
    },
    density: {
      control: 'inline-radio',
      options: ['compact', 'normal', 'comfortable'],
    },
    scrollBehavior: {
      control: 'inline-radio',
      options: ['virtualization', 'pagination', 'infinite-scroll'],
    },
    pageSize: {
      control: { type: 'number', min: 5, max: 100, step: 5 },
    },
    enableHighContrast: {
      control: 'boolean',
    },
    enableDetailPanelToggle: {
      control: 'boolean',
    },
    defaultDetailPanelVisible: {
      control: 'boolean',
    },
    syncDetailWithScroll: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof TypedAmroInventoryDataGridTemplate>;

function InteractiveTemplate(args: AmroInventoryDataGridTemplateProps<InventoryRecord>) {
  const [eventLog, setEventLog] = React.useState<string[]>([]);
  const lastScrollLogAtRef = React.useRef(0);
  const appendLog = React.useCallback((entry: string) => {
    setEventLog((prev) => [`${new Date().toLocaleTimeString()} - ${entry}`, ...prev].slice(0, 8));
  }, []);
  const handleRecordSelectionChange = React.useCallback((event: Parameters<NonNullable<AmroInventoryDataGridTemplateProps<InventoryRecord>['onRecordSelectionChange']>>[0]) => {
    appendLog(`selection: ${event.recordId} (${event.source})`);
    args.onRecordSelectionChange?.(event);
  }, [appendLog, args]);
  const handleScrollPositionChange = React.useCallback((event: Parameters<NonNullable<AmroInventoryDataGridTemplateProps<InventoryRecord>['onScrollPositionChange']>>[0]) => {
    const now = Date.now();
    if (now - lastScrollLogAtRef.current > 500) {
      appendLog(`scroll: first=${event.firstVisibleIndex} last=${event.lastVisibleIndex} top=${Math.round(event.scrollTop)}`);
      lastScrollLogAtRef.current = now;
    }
    args.onScrollPositionChange?.(event);
  }, [appendLog, args]);
  const handleViewModeChange = React.useCallback((event: Parameters<NonNullable<AmroInventoryDataGridTemplateProps<InventoryRecord>['onViewModeChange']>>[0]) => {
    appendLog(`view: requested=${event.requested} effective=${event.effective} width=${event.viewportWidth}`);
    args.onViewModeChange?.(event);
  }, [appendLog, args]);
  const handleDetailPanelVisibilityChange = React.useCallback((visible: boolean) => {
    appendLog(`detail panel: ${visible ? 'visible' : 'hidden'}`);
    args.onDetailPanelVisibilityChange?.(visible);
  }, [appendLog, args]);

  return (
    <div className="space-y-3">
      <TypedAmroInventoryDataGridTemplate
        {...args}
        onRecordSelectionChange={handleRecordSelectionChange}
        onScrollPositionChange={handleScrollPositionChange}
        onViewModeChange={handleViewModeChange}
        onDetailPanelVisibilityChange={handleDetailPanelVisibilityChange}
        renderDetail={(record) => (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="font-semibold">Record:</span> {record.id}</div>
              <div><span className="font-semibold">Part:</span> {record.partNumber}</div>
              <div><span className="font-semibold">Quantity:</span> {record.quantity}</div>
              <div><span className="font-semibold">Owner:</span> {record.owner}</div>
              <div><span className="font-semibold">Category:</span> {record.category}</div>
              <div><span className="font-semibold">Serviceable:</span> {record.serviceable ? 'Yes' : 'No'}</div>
            </div>
            <div className="rounded-md bg-muted p-2 text-xs">
              <div className="font-semibold">Metadata</div>
              <pre className="whitespace-pre-wrap">{JSON.stringify(record.metadata, null, 2)}</pre>
            </div>
          </div>
        )}
      />
      <div className="rounded-md border p-3">
        <h4 className="mb-2 text-sm font-semibold">Event Stream</h4>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {eventLog.length > 0 ? eventLog.map((entry) => <li key={entry}>{entry}</li>) : <li>No events captured yet.</li>}
        </ul>
      </div>
    </div>
  );
}

export const Playground: Story = {
  render: (args) => <InteractiveTemplate {...args} />,
  args: {
    title: 'AMRO Inventory Grid Template',
    subtitle: 'Split-layout grid with synchronized detail panel',
    records: mockRecords,
    columns,
    viewMode: 'horizontal-split',
    density: 'normal',
    scrollBehavior: 'virtualization',
    pageSize: 20,
    enableHighContrast: false,
    enableDetailPanelToggle: true,
    defaultDetailPanelVisible: true,
    syncDetailWithScroll: true,
    persistKey: 'storybook-amro-grid-template',
  },
};

export const HorizontalSplit: Story = {
  ...Playground,
  args: {
    ...Playground.args,
    viewMode: 'horizontal-split',
  },
};

export const VerticalSplit: Story = {
  ...Playground,
  args: {
    ...Playground.args,
    viewMode: 'vertical-split',
  },
};

export const ResponsiveStacked: Story = {
  ...Playground,
  args: {
    ...Playground.args,
    viewMode: 'stacked-auto',
  },
};
