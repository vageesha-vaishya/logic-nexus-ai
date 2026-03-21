import { PlatformWidgetSlot } from '@/components/ui/enterprise';
import type { ReactNode } from 'react';
import { LogisticsOwnedWorkspace } from '../components/LogisticsOwnedWorkspace';

type LogisticsModuleShellProps = {
  children: ReactNode;
};

function LogisticsModuleShell({ children }: LogisticsModuleShellProps) {
  return (
    <section data-module-shell="module-logistics" className="h-full w-full">
      {children}
    </section>
  );
}

function LogisticsWorkspaceSurface() {
  return <LogisticsOwnedWorkspace />;
}

export default function ShipmentsPipelineVerticalPage() {
  return (
    <LogisticsModuleShell>
      <PlatformWidgetSlot
        widgets={[
          {
            id: 'logistics-contract',
            title: 'Logistics Contract Widget',
            content: 'Pricing and compliance references are embedded as read-only platform widgets.',
          },
          {
            id: 'logistics-interaction-contract',
            title: 'Logistics Interaction Contract',
            content: 'Leg rendering, route validation, diagnostics, and retries remain logistics-owned interactions.',
          },
        ]}
      >
        <LogisticsWorkspaceSurface />
      </PlatformWidgetSlot>
    </LogisticsModuleShell>
  );
}
