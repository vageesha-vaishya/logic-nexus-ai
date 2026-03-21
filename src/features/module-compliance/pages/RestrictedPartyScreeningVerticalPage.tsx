import { PlatformWidgetSlot } from '@/components/ui/enterprise';
import type { ReactNode } from 'react';
import { ComplianceOwnedWorkspace } from '../components/ComplianceOwnedWorkspace';

type ComplianceModuleShellProps = {
  children: ReactNode;
};

function ComplianceModuleShell({ children }: ComplianceModuleShellProps) {
  return (
    <section data-module-shell="module-compliance" className="h-full w-full">
      {children}
    </section>
  );
}

function ComplianceWorkspaceSurface() {
  return <ComplianceOwnedWorkspace />;
}

export default function RestrictedPartyScreeningVerticalPage() {
  return (
    <ComplianceModuleShell>
      <PlatformWidgetSlot
        widgets={[
          {
            id: 'compliance-contract',
            title: 'Compliance Contract Widget',
            content: 'Decision panels consume policy outcomes through governed platform contracts.',
          },
          {
            id: 'compliance-upstream-contract',
            title: 'Compliance Upstream Contract',
            content: 'Upstream modules consume read-only compliance badges and decision summaries only.',
          },
          {
            id: 'compliance-evidence-contract',
            title: 'Compliance Evidence Contract',
            content: 'Evidence artifacts remain compliance-owned and are exposed through signed references.',
          },
        ]}
      >
        <ComplianceWorkspaceSurface />
      </PlatformWidgetSlot>
    </ComplianceModuleShell>
  );
}
