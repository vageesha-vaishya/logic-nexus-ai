import QuotationManager from '@/pages/dashboard/QuotationManager';
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

export default function QuotesPipelineVerticalPage() {
  return (
    <QuotationModuleShell>
      <QuotationManager />
    </QuotationModuleShell>
  );
}
