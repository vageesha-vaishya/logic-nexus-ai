import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Badge } from '@/components/ui/badge';
import {
  AmroInventoryDataGridTemplate,
  type AmroInventoryDataGridTemplateProps,
  type GridColumnDefinition,
} from './AmroInventoryDataGridTemplate';
import {
  amroPartsEnterpriseArgTypes,
  amroPartsEnterpriseDecorator,
  amroPartsEnterpriseParameters,
  buildAmroPartsEnterpriseDocsDescription,
} from '../parts/storybook/amroPartsEnterpriseStoryTemplate';

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

const longContentRecords: InventoryRecord[] = Array.from({ length: 40 }).map((_, index) => ({
  id: `LONG-${String(index + 1).padStart(4, '0')}`,
  partNumber: `PN-ULTRA-LONG-${100000 + index}-AFT-COMPONENT-SERIES`,
  description: `High-cycle pressure regulator assembly with extended maintenance narrative and serialized compliance remarks for aircraft ${index + 1}.`,
  quantity: Math.max(0, 40 - (index % 11)),
  lastUpdated: new Date(2026, (index % 12), ((index % 27) + 1)).toISOString(),
  serviceable: index % 4 !== 0,
  metadata: {
    aisle: `ZONE-${(index % 6) + 1}-NORTH-WING-BLOCK`,
    bin: `BIN-${(index % 13) + 1}-OVERSIZE-COMPARTMENT`,
    tags: [
      'traceability-required',
      'long-content-validation',
      'separator-persistence-check',
      index % 2 === 0 ? 'serialized-inspection-cycle' : 'deferred-planning-review',
    ],
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
    ...amroPartsEnterpriseParameters,
    docs: {
      ...(amroPartsEnterpriseParameters.docs || {}),
      description: {
        component: buildAmroPartsEnterpriseDocsDescription({
          componentId: 'AMRO-INVENTORY-DATAGRID-TEMPLATE',
          ownerTeam: 'AMRO Platform Team',
          releaseRing: 'production',
          dataClassification: 'internal',
          approvalPolicy: 'two_person_review_required',
          auditReference: 'SCR-AMRO-TEMPLATES-DATAGRID',
        }),
      },
    },
  },
  decorators: [amroPartsEnterpriseDecorator],
  tags: ['autodocs', 'amro', 'parts', 'enterprise'],
  argTypes: {
    ...amroPartsEnterpriseArgTypes,
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
    onCrudAction: { action: 'crud-action' },
    onCreateRecord: { action: 'create-record' },
    onReadRecord: { action: 'read-record' },
    onUpdateRecord: { action: 'update-record' },
    onDeleteRecord: { action: 'delete-record' },
    onSaveRecord: { action: 'save-record' },
    onCancelRecord: { action: 'cancel-record' },
  },
};

export default meta;
type Story = StoryObj<typeof TypedAmroInventoryDataGridTemplate>;

function InteractiveTemplate(args: AmroInventoryDataGridTemplateProps<InventoryRecord>) {
  const [eventLog, setEventLog] = React.useState<string[]>([]);
  const [crudLog, setCrudLog] = React.useState<string[]>([]);
  const lastScrollLogAtRef = React.useRef(0);
  const appendLog = React.useCallback((entry: string) => {
    setEventLog((prev) => [`${new Date().toLocaleTimeString()} - ${entry}`, ...prev].slice(0, 8));
  }, []);
  const appendCrudLog = React.useCallback((entry: string) => {
    setCrudLog((prev) => [`${new Date().toLocaleTimeString()} - ${entry}`, ...prev].slice(0, 8));
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
  const handleCrudAction = React.useCallback((action: string, record: InventoryRecord | null) => {
    appendCrudLog(`crud: ${action}${record?.id ? ` on ${record.id}` : ''}`);
    args.onCrudAction?.(action as never, record as never);
  }, [appendCrudLog, args]);
  const handleCreateRecord = React.useCallback(() => {
    appendCrudLog('create record');
    args.onCreateRecord?.();
  }, [appendCrudLog, args]);
  const handleReadRecord = React.useCallback((record: InventoryRecord) => {
    appendCrudLog(`read ${record.id}`);
    args.onReadRecord?.(record);
  }, [appendCrudLog, args]);
  const handleUpdateRecord = React.useCallback((record: InventoryRecord) => {
    appendCrudLog(`update ${record.id}`);
    args.onUpdateRecord?.(record);
  }, [appendCrudLog, args]);
  const handleDeleteRecord = React.useCallback((record: InventoryRecord) => {
    appendCrudLog(`delete ${record.id}`);
    args.onDeleteRecord?.(record);
  }, [appendCrudLog, args]);
  const handleSaveRecord = React.useCallback((record: InventoryRecord) => {
    appendCrudLog(`save ${record.id}`);
    args.onSaveRecord?.(record);
  }, [appendCrudLog, args]);
  const handleCancelRecord = React.useCallback((record: InventoryRecord) => {
    appendCrudLog(`cancel ${record.id}`);
    args.onCancelRecord?.(record);
  }, [appendCrudLog, args]);

  return (
    <div className="space-y-3">
      <TypedAmroInventoryDataGridTemplate
        {...args}
        onRecordSelectionChange={handleRecordSelectionChange}
        onScrollPositionChange={handleScrollPositionChange}
        onViewModeChange={handleViewModeChange}
        onDetailPanelVisibilityChange={handleDetailPanelVisibilityChange}
        onCrudAction={handleCrudAction}
        onCreateRecord={handleCreateRecord}
        onReadRecord={handleReadRecord}
        onUpdateRecord={handleUpdateRecord}
        onDeleteRecord={handleDeleteRecord}
        onSaveRecord={handleSaveRecord}
        onCancelRecord={handleCancelRecord}
      />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-md border p-3">
          <h4 className="mb-2 text-sm font-semibold">Event Stream</h4>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {eventLog.length > 0 ? eventLog.map((entry) => <li key={entry}>{entry}</li>) : <li>No events captured yet.</li>}
          </ul>
        </div>
        <div className="rounded-md border p-3">
          <h4 className="mb-2 text-sm font-semibold">CRUD Events</h4>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {crudLog.length > 0 ? crudLog.map((entry) => <li key={entry}>{entry}</li>) : <li>No CRUD actions captured yet.</li>}
          </ul>
        </div>
      </div>
      <div className="rounded-md border p-3">
        <h4 className="mb-2 text-sm font-semibold">Viewport Validation Checklist (1366x768)</h4>
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li>1. Record Detail form remains fully usable without horizontal scrolling.</li>
          <li>2. Sticky action bar remains visible while scrolling long forms.</li>
          <li>3. Grid/detail separator supports mouse drag and keyboard resize.</li>
          <li>4. Collapsible panel controls keep navigation accessible.</li>
          <li>5. Focus states are visible for action buttons and separator handle.</li>
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
    onCrudAction: fn(),
    onCreateRecord: fn(),
    onReadRecord: fn(),
    onUpdateRecord: fn(),
    onDeleteRecord: fn(),
    onSaveRecord: fn(),
    onCancelRecord: fn(),
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

export const Desktop1366Validation: Story = {
  ...Playground,
  args: {
    ...Playground.args,
    viewMode: 'horizontal-split',
    density: 'normal',
  },
  parameters: {
    viewport: {
      defaultViewport: 'desktop1366',
      viewports: {
        desktop1366: {
          name: 'Desktop 1366x768',
          styles: {
            width: '1366px',
            height: '768px',
          },
          type: 'desktop',
        },
      },
    },
  },
};

export const ReadOnlyRole: Story = {
  ...Playground,
  args: {
    ...Playground.args,
    crudPermissions: {
      create: false,
      read: true,
      update: false,
      delete: false,
      save: false,
      cancel: false,
    },
  },
};

export const EditorRole: Story = {
  ...Playground,
  args: {
    ...Playground.args,
    crudPermissions: {
      create: true,
      read: true,
      update: true,
      delete: false,
      save: true,
      cancel: true,
    },
  },
};

export const LongContentSeparatorValidation: Story = {
  ...Playground,
  args: {
    ...Playground.args,
    title: 'AMRO Inventory Grid Template - Long Content Separator Validation',
    subtitle: 'Stress scenario for separator persistence with long text, deep metadata, and narrow viewport rendering.',
    records: longContentRecords,
    viewMode: 'stacked-auto',
    density: 'comfortable',
    scrollBehavior: 'pagination',
    pageSize: 10,
  },
  parameters: {
    docs: {
      description: {
        story: 'Validates persistent separator boxes under extreme content length and narrow viewport conditions. Confirm no overlap between separator, field blocks, and panel boundaries.',
      },
    },
    viewport: {
      defaultViewport: 'mobileStress',
      viewports: {
        mobileStress: {
          name: 'Mobile Stress 390x844',
          styles: {
            width: '390px',
            height: '844px',
          },
          type: 'mobile',
        },
      },
    },
  },
};
