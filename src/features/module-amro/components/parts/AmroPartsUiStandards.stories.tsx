import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '@/components/ui/button';
import { AmroKpiGrid, AmroModuleSurface, AmroStandardToolbar } from './AmroPartsUiStandards';

const meta: Meta = {
  title: 'AMRO/Parts/UI Standards',
  parameters: {
    layout: 'fullscreen',
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/AMRO-PARTS-NAVIGATION/AMRO-Parts-Navigation-System',
    },
  },
};

export default meta;
type Story = StoryObj;

export const ModuleSurface: Story = {
  render: () => (
    <div className="p-4">
      <AmroModuleSurface
        title="Stock Ledger"
        subtitle="Unified module surface template"
        moduleId="inventory-core.stock-ledger"
        status="ready"
      >
        <p className="text-sm text-muted-foreground">Use this shell for all AMRO Parts module panels.</p>
      </AmroModuleSurface>
    </div>
  ),
};

export const StandardToolbar: Story = {
  render: () => (
    <div className="p-4">
      <AmroStandardToolbar
        searchValue="hydraulic"
        onSearchChange={() => undefined}
        leftActions={<Button size="sm" className="h-8">Save View</Button>}
        rightActions={<Button variant="outline" size="sm" className="h-8">Export</Button>}
        placeholder="Search parts, references, notes..."
      />
    </div>
  ),
};

export const KpiGrid: Story = {
  render: () => (
    <div className="p-4">
      <AmroKpiGrid
        items={[
          { label: 'Total Items', value: '420' },
          { label: 'Low Stock', value: '12', tone: 'warning' },
          { label: 'Ready for Issue', value: '108', tone: 'success' },
        ]}
      />
    </div>
  ),
};
