import { PlatformWidgetSlot } from '@/components/ui/enterprise';
import type { ReactNode } from 'react';
import { FinanceOwnedWorkspace } from '../components/FinanceOwnedWorkspace';

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
  return <FinanceOwnedWorkspace />;
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
          {
            id: 'finance-mutation-contract',
            title: 'Finance Mutation Guard',
            content: 'Mutation actions are role-gated and committed records route to compensating workflows.',
          },
          {
            id: 'finance-reconciliation-contract',
            title: 'Finance Reconciliation Contract',
            content: 'Discrepancies expose drill-down pointers to traceable source records.',
          },
        ]}
      >
        <FinanceWorkspaceSurface />
      </PlatformWidgetSlot>
    </FinanceModuleShell>
  );
}
