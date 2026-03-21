import ShipmentsPipelineLegacy from '@/pages/dashboard/ShipmentsPipeline';
import { PlatformWidgetSlot } from '@/components/ui/enterprise';
import type { ReactNode } from 'react';

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
  return <ShipmentsPipelineLegacy />;
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
        ]}
      >
        <LogisticsWorkspaceSurface />
      </PlatformWidgetSlot>
    </LogisticsModuleShell>
  );
}
