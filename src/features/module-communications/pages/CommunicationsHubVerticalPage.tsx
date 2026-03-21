import { PlatformWidgetSlot } from '@/components/ui/enterprise';
import type { ReactNode } from 'react';
import { CommunicationsOwnedWorkspace } from '../components/CommunicationsOwnedWorkspace';

type CommunicationsModuleShellProps = {
  children: ReactNode;
};

function CommunicationsModuleShell({ children }: CommunicationsModuleShellProps) {
  return (
    <section data-module-shell="module-communications" className="h-full w-full">
      {children}
    </section>
  );
}

function CommunicationsWorkspaceSurface() {
  return <CommunicationsOwnedWorkspace />;
}

export default function CommunicationsHubVerticalPage() {
  return (
    <CommunicationsModuleShell>
      <PlatformWidgetSlot
        widgets={[
          {
            id: 'communications-contract',
            title: 'Communications Contract Widget',
            content: 'Delivery operations expose provider-agnostic action APIs to other vertical modules.',
          },
          {
            id: 'communications-provider-boundary',
            title: 'Provider Diagnostics Boundary',
            content: 'Provider adapters and diagnostics remain communications-owned and are not rendered externally.',
          },
          {
            id: 'communications-template-sandbox',
            title: 'Template Sandbox Contract',
            content: 'Template rendering previews execute in sandboxed communications surfaces only.',
          },
        ]}
      >
        <CommunicationsWorkspaceSurface />
      </PlatformWidgetSlot>
    </CommunicationsModuleShell>
  );
}
