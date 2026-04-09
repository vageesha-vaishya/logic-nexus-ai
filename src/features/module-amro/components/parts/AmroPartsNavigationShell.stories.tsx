import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { AmroPartsNavigationShell } from './AmroPartsNavigationShell';

const meta: Meta<typeof AmroPartsNavigationShell> = {
  title: 'AMRO/Parts/Navigation Shell',
  component: AmroPartsNavigationShell,
  parameters: {
    layout: 'fullscreen',
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/AMRO-PARTS-NAVIGATION/AMRO-Parts-Navigation-System',
    },
  },
};

export default meta;
type Story = StoryObj<typeof AmroPartsNavigationShell>;

function StorySurface(): JSX.Element {
  const [active, setActive] = useState('overview');
  return (
    <div className="p-4">
      <AmroPartsNavigationShell
        activeRole="management"
        onModuleChange={(moduleId) => setActive(moduleId)}
        renderModule={(moduleId) => (
          <div className="rounded-md border p-6 text-sm">
            Active module: {moduleId}
            <div className="mt-1 text-xs text-muted-foreground">Last switch: {active}</div>
          </div>
        )}
      />
    </div>
  );
}

export const Management: Story = {
  render: () => <StorySurface />,
};

export const TechnicianRole: Story = {
  render: () => (
    <div className="p-4">
      <AmroPartsNavigationShell
        activeRole="technician"
        renderModule={(moduleId) => (
          <div className="rounded-md border p-6 text-sm">Technician active module: {moduleId}</div>
        )}
      />
    </div>
  ),
};
