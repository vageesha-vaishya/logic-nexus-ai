import RestrictedPartyScreeningLegacy from '@/pages/dashboard/RestrictedPartyScreening';
import { PlatformWidgetSlot } from '@/components/ui/enterprise';
import type { ReactNode } from 'react';

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
  return <RestrictedPartyScreeningLegacy />;
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
        ]}
      >
        <ComplianceWorkspaceSurface />
      </PlatformWidgetSlot>
    </ComplianceModuleShell>
  );
}
