import CRMWorkspaceLegacy from '@/pages/dashboard/CRMWorkspace';
import { PlatformWidgetSlot } from '@/components/ui/enterprise';
import type { ReactNode } from 'react';

type CRMModuleShellProps = {
  children: ReactNode;
};

function CRMModuleShell({ children }: CRMModuleShellProps) {
  return (
    <section data-module-shell="module-crm" className="h-full w-full">
      {children}
    </section>
  );
}

function CRMWorkspaceSurface() {
  return <CRMWorkspaceLegacy />;
}

export default function CRMWorkspaceVerticalPage() {
  return (
    <CRMModuleShell>
      <PlatformWidgetSlot
        widgets={[
          {
            id: 'crm-contract',
            title: 'CRM Contract Widget',
            content: 'Cross-domain references are rendered through platform widget contracts.',
          },
        ]}
      >
        <CRMWorkspaceSurface />
      </PlatformWidgetSlot>
    </CRMModuleShell>
  );
}
