import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import {
  AmroPartsInventoryWorkbench,
  type AmroPartsInventoryWorkbenchProps,
} from './AmroPartsInventoryWorkbench';
import { generatePartInventoryRecords } from './mockPartsInventoryData';
import {
  amroPartsEnterpriseArgTypes,
  amroPartsEnterpriseDecorator,
  amroPartsEnterpriseParameters,
  buildAmroPartsEnterpriseDocsDescription,
} from './storybook/amroPartsEnterpriseStoryTemplate';

type WorkbenchStoryArgs = Omit<AmroPartsInventoryWorkbenchProps, 'records'> & {
  recordCount: number;
  includeExpired: boolean;
};

const meta: Meta<WorkbenchStoryArgs> = {
  title: 'AMRO/Parts/AmroPartsInventoryWorkbench',
  parameters: {
    ...amroPartsEnterpriseParameters,
    docs: {
      ...(amroPartsEnterpriseParameters.docs || {}),
      description: {
        component: buildAmroPartsEnterpriseDocsDescription({
          componentId: 'AMRO-PARTS-WORKBENCH',
          ownerTeam: 'AMRO Platform Team',
          releaseRing: 'production',
          dataClassification: 'internal',
          approvalPolicy: 'two_person_review_required',
          auditReference: 'SCR-AMRO-PARTS-ENTERPRISE-STORYBOOK',
        }),
      },
    },
  },
  decorators: [amroPartsEnterpriseDecorator],
  tags: ['autodocs', 'amro', 'parts', 'enterprise'],
  argTypes: {
    ...amroPartsEnterpriseArgTypes,
    state: {
      control: 'inline-radio',
      options: ['loading', 'empty', 'ready', 'error'],
    },
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
    recordCount: {
      control: { type: 'number', min: 0, max: 1000, step: 20 },
    },
    includeExpired: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<WorkbenchStoryArgs>;

function StoryRenderer(args: WorkbenchStoryArgs) {
  const records = React.useMemo(
    () => generatePartInventoryRecords({ count: args.recordCount, includeExpired: args.includeExpired, seed: 77 }),
    [args.recordCount, args.includeExpired],
  );

  const [events, setEvents] = React.useState<string[]>([]);
  const append = React.useCallback((message: string) => {
    setEvents((previous) => [`${new Date().toLocaleTimeString()} · ${message}`, ...previous].slice(0, 6));
  }, []);

  const resolvedState = args.state === 'empty' ? 'empty' : args.state;
  const resolvedRecords = resolvedState === 'empty' ? [] : records;

  return (
    <div className="space-y-3 p-4 md:p-6">
      <AmroPartsInventoryWorkbench
        {...args}
        state={resolvedState}
        records={resolvedRecords}
        onRetry={() => {
          append('Retry clicked');
          args.onRetry?.();
        }}
        onRefresh={() => {
          append('Refresh clicked');
          args.onRefresh?.();
        }}
        onCreatePart={() => {
          append('Add Part clicked');
          args.onCreatePart?.();
        }}
        onRecordSelectionChange={(event) => {
          append(`Selected ${event.recordId} via ${event.source}`);
          args.onRecordSelectionChange?.(event);
        }}
        onScrollPositionChange={(event) => {
          append(`Scroll first=${event.firstVisibleIndex} last=${event.lastVisibleIndex}`);
          args.onScrollPositionChange?.(event);
        }}
        onViewModeChange={(event) => {
          append(`View ${event.requested} => ${event.effective}`);
          args.onViewModeChange?.(event);
        }}
      />
      <div className="rounded-md border bg-background p-3 text-xs text-muted-foreground">
        <p className="mb-2 font-semibold text-foreground">Interaction Events</p>
        {events.length ? (
          <ul className="space-y-1">
            {events.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        ) : (
          <p>No interactions yet.</p>
        )}
      </div>
    </div>
  );
}

export const Populated: Story = {
  render: (args) => <StoryRenderer {...args} />,
  args: {
    state: 'ready',
    title: 'AMRO Parts Inventory',
    subtitle: 'Operational table and side-by-side detail view for parts inventory records.',
    viewMode: 'horizontal-split',
    density: 'normal',
    scrollBehavior: 'virtualization',
    pageSize: 25,
    recordCount: 220,
    includeExpired: true,
    onRetry: fn(),
    onRefresh: fn(),
    onCreatePart: fn(),
  },
};

export const Loading: Story = {
  ...Populated,
  args: {
    ...Populated.args,
    state: 'loading',
  },
};

export const Empty: Story = {
  ...Populated,
  args: {
    ...Populated.args,
    state: 'empty',
    recordCount: 0,
  },
};

export const ErrorState: Story = {
  ...Populated,
  args: {
    ...Populated.args,
    state: 'error',
    errorMessage: 'AMRO parts inventory endpoint timeout: /api/v2/amro/inventory/sync',
  },
};

export const VerticalWorkflow: Story = {
  ...Populated,
  args: {
    ...Populated.args,
    viewMode: 'vertical-split',
    density: 'comfortable',
  },
};

export const ResponsiveStacked: Story = {
  ...Populated,
  args: {
    ...Populated.args,
    viewMode: 'stacked-auto',
    scrollBehavior: 'infinite-scroll',
    density: 'compact',
  },
};
