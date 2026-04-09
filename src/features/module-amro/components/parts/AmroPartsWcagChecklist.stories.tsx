import type { Meta, StoryObj } from '@storybook/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type ChecklistProps = {
  moduleLabel: string;
  checks: string[];
};

function ChecklistStory({ moduleLabel, checks }: ChecklistProps): JSX.Element {
  return (
    <div className="p-4">
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="text-base">{moduleLabel} WCAG 2.1 AA Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {checks.map((check) => <li key={check}>{check}</li>)}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

const meta: Meta<typeof ChecklistStory> = {
  title: 'AMRO/Parts/WCAG Checklists',
  component: ChecklistStory,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Per-module accessibility validation checklist used during UI standardization and regression review.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ChecklistStory>;

const baseChecks = [
  'All interactive controls are keyboard focusable and operable (Tab + Enter/Space).',
  'Visible focus indicator is present for all actionable controls.',
  'Text and control contrast meets WCAG 2.1 AA in default and active states.',
  'Error states expose meaningful text feedback and are announced to assistive technologies.',
  'Tables expose semantic headers and maintain reading order for screen readers.',
  'Responsive layouts preserve function and readability from mobile through desktop.',
];

export const OverviewChecklist: Story = {
  args: {
    moduleLabel: 'Overview',
    checks: [
      ...baseChecks,
      'Fallback warning state includes textual diagnostics and does not rely only on color.',
      'Inventory grid remains navigable with keyboard and virtualized content behaviors.',
    ],
  },
};

export const ItemMasterChecklist: Story = {
  args: {
    moduleLabel: 'Item Master',
    checks: [
      ...baseChecks,
      'Dialog tabs are keyboard reachable and preserve active context after save/cancel.',
      'Cross-reference and UOM dynamic row actions expose clear labels for assistive tech.',
    ],
  },
};

export const StockLedgerChecklist: Story = {
  args: {
    moduleLabel: 'Stock Ledger',
    checks: [
      ...baseChecks,
      'Period controls and approval queue selectors support keyboard navigation and labels.',
      'Reconciliation and export action buttons provide non-ambiguous action text.',
    ],
  },
};
