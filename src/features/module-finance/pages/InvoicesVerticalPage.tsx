import InvoicesLegacy from '@/pages/dashboard/finance/Invoices';
import { PlatformWidgetSlot } from '@/components/ui/enterprise';
import type { ReactNode } from 'react';

type FinanceModuleShellProps = {
  children: ReactNode;
};

function FinanceModuleShell({ children }: FinanceModuleShellProps) {
  return (
    <section data-module-shell="module-finance" className="h-full w-full">
      {children}
    </section>
  );
}

function FinanceWorkspaceSurface() {
  return <InvoicesLegacy />;
}

export default function InvoicesVerticalPage() {
  return (
    <FinanceModuleShell>
      <PlatformWidgetSlot
        widgets={[
          {
            id: 'finance-contract',
            title: 'Finance Contract Widget',
            content: 'Cross-module context is linked as references without inline mutation rights.',
          },
        ]}
      >
        <FinanceWorkspaceSurface />
      </PlatformWidgetSlot>
    </FinanceModuleShell>
  );
}
