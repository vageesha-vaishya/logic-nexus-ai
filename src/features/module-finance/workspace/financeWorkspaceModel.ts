export type FinanceInvoiceLifecycle = 'draft' | 'review' | 'committed';

export type FinanceInvoiceRecord = {
  id: string;
  invoiceNumber: string;
  lifecycle: FinanceInvoiceLifecycle;
  currencyCode: string;
  taxJurisdiction: string;
  receivableAmount: number;
  marginAmount: number;
  quoteReferenceId: string;
  shipmentReferenceId: string;
  accountReferenceId: string;
};

export type FinanceTaxBreakdown = {
  id: string;
  jurisdiction: string;
  category: string;
  rate: number;
  amount: number;
  committed: boolean;
};

export type FinanceJournalReview = {
  id: string;
  journalNumber: string;
  ledgerAccount: string;
  debit: number;
  credit: number;
  committed: boolean;
  sourcePointer: string;
};

export type FinanceReconciliationDiscrepancy = {
  id: string;
  summary: string;
  amountDelta: number;
  sourcePointer: string;
  sourceModule: 'quotation' | 'logistics' | 'finance';
  details: string;
};

export type FinanceMutationAction = 'save_draft' | 'commit_invoice' | 'adjust_tax';

export function isImmutableFinanceRecord(lifecycle: FinanceInvoiceLifecycle): boolean {
  return lifecycle === 'committed';
}

export function canRunFinanceMutation(isAuthorized: boolean, lifecycle: FinanceInvoiceLifecycle): boolean {
  return isAuthorized && !isImmutableFinanceRecord(lifecycle);
}

export function getCompensatingWorkflowPath(invoiceId: string): string {
  return `/dashboard/finance/invoices/${invoiceId}?workflow=compensating-adjustment`;
}

export function buildReceivablesAndMarginAnalytics(invoices: FinanceInvoiceRecord[]) {
  const receivablesTotal = invoices.reduce((total, invoice) => total + invoice.receivableAmount, 0);
  const marginTotal = invoices.reduce((total, invoice) => total + invoice.marginAmount, 0);
  const committedCount = invoices.filter((invoice) => invoice.lifecycle === 'committed').length;
  return {
    receivablesTotal,
    marginTotal,
    committedCount,
    averageMarginRate: receivablesTotal === 0 ? 0 : Number(((marginTotal / receivablesTotal) * 100).toFixed(2)),
  };
}
