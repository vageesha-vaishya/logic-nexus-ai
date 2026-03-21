import QuotesPipelineLegacy from '@/pages/dashboard/QuotesPipeline';
import { PlatformWidgetSlot } from '@/components/ui/enterprise';
import type { ReactNode } from 'react';

type QuotationModuleShellProps = {
  children: ReactNode;
};

function QuotationModuleShell({ children }: QuotationModuleShellProps) {
  return (
    <section data-module-shell="module-quotation" className="h-full w-full">
      {children}
    </section>
  );
}

function QuotationWorkspaceSurface() {
  return <QuotesPipelineLegacy />;
}

export default function QuotesPipelineVerticalPage() {
  return (
    <QuotationModuleShell>
      <PlatformWidgetSlot
        widgets={[
          {
            id: 'quotation-contract',
            title: 'Quotation Contract Widget',
            content: 'Route and compliance projections are consumed through explicit widget contracts.',
          },
        ]}
      >
        <QuotationWorkspaceSurface />
      </PlatformWidgetSlot>
    </QuotationModuleShell>
  );
}
