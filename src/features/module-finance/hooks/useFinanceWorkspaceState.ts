import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type {
  FinanceInvoiceRecord,
  FinanceJournalReview,
  FinanceMutationAction,
  FinanceReconciliationDiscrepancy,
  FinanceTaxBreakdown,
} from '../workspace/financeWorkspaceModel';
import {
  buildReceivablesAndMarginAnalytics,
  canRunFinanceMutation,
  getCompensatingWorkflowPath,
  isImmutableFinanceRecord,
} from '../workspace/financeWorkspaceModel';

const initialInvoices: FinanceInvoiceRecord[] = [
  {
    id: 'inv-1001',
    invoiceNumber: 'INV-2026-1001',
    lifecycle: 'draft',
    currencyCode: 'USD',
    taxJurisdiction: 'US-CA',
    receivableAmount: 52800,
    marginAmount: 8200,
    quoteReferenceId: 'QT-8821',
    shipmentReferenceId: 'SHP-5502',
    accountReferenceId: 'ACC-102',
  },
  {
    id: 'inv-1002',
    invoiceNumber: 'INV-2026-1002',
    lifecycle: 'review',
    currencyCode: 'AED',
    taxJurisdiction: 'AE-DU',
    receivableAmount: 37120,
    marginAmount: 5450,
    quoteReferenceId: 'QT-8844',
    shipmentReferenceId: 'SHP-5518',
    accountReferenceId: 'ACC-221',
  },
  {
    id: 'inv-1003',
    invoiceNumber: 'INV-2026-1003',
    lifecycle: 'committed',
    currencyCode: 'EUR',
    taxJurisdiction: 'DE-BE',
    receivableAmount: 21450,
    marginAmount: 3070,
    quoteReferenceId: 'QT-8890',
    shipmentReferenceId: 'SHP-5577',
    accountReferenceId: 'ACC-009',
  },
];

const initialTaxBreakdown: FinanceTaxBreakdown[] = [
  { id: 'tax-1', jurisdiction: 'US-CA', category: 'VAT', rate: 7.25, amount: 1312, committed: false },
  { id: 'tax-2', jurisdiction: 'US-CA', category: 'Local Tax', rate: 1.25, amount: 226, committed: false },
  { id: 'tax-3', jurisdiction: 'US-CA', category: 'Environmental Fee', rate: 0.5, amount: 90, committed: true },
];

const initialJournals: FinanceJournalReview[] = [
  {
    id: 'jr-1',
    journalNumber: 'JR-10021',
    ledgerAccount: '1100-AR-Control',
    debit: 54328,
    credit: 0,
    committed: false,
    sourcePointer: '/dashboard/finance/invoices/inv-1001#line-1',
  },
  {
    id: 'jr-2',
    journalNumber: 'JR-10022',
    ledgerAccount: '4100-Revenue',
    debit: 0,
    credit: 52790,
    committed: true,
    sourcePointer: '/dashboard/finance/invoices/inv-1003#line-4',
  },
];

const initialDiscrepancies: FinanceReconciliationDiscrepancy[] = [
  {
    id: 'recon-1',
    summary: 'Tax variance between invoice and journal',
    amountDelta: 84,
    sourcePointer: '/dashboard/finance/invoices/inv-1001#tax',
    sourceModule: 'finance',
    details: 'Invoice tax total is 84 higher than posted journal tax bucket.',
  },
  {
    id: 'recon-2',
    summary: 'Shipment milestone billed before completion',
    amountDelta: 450,
    sourcePointer: '/dashboard/shipments/SHP-5518#milestones',
    sourceModule: 'logistics',
    details: 'On-carriage milestone not complete while charge line is already included.',
  },
];

export function useFinanceWorkspaceState() {
  const { hasPermission, hasRole, isPlatformAdmin } = useAuth();
  const [invoices, setInvoices] = useState<FinanceInvoiceRecord[]>(initialInvoices);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(initialInvoices[0]?.id ?? '');
  const [taxBreakdown, setTaxBreakdown] = useState<FinanceTaxBreakdown[]>(initialTaxBreakdown);
  const [journalRows, setJournalRows] = useState<FinanceJournalReview[]>(initialJournals);
  const [discrepancies] = useState<FinanceReconciliationDiscrepancy[]>(initialDiscrepancies);
  const [expandedDiscrepancyId, setExpandedDiscrepancyId] = useState<string>(initialDiscrepancies[0]?.id ?? '');
  const [mutationState, setMutationState] = useState<'idle' | 'saved' | 'committed' | 'blocked'>('idle');
  const [pendingCompensatingWorkflowPath, setPendingCompensatingWorkflowPath] = useState<string>('');

  const selectedInvoice = useMemo(
    () => invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? invoices[0] ?? null,
    [invoices, selectedInvoiceId]
  );

  const isFinanceMutationAuthorized = useMemo(() => {
    if (isPlatformAdmin()) return true;
    return hasPermission('admin.settings.manage') && (hasRole('platform_admin') || hasRole('tenant_admin'));
  }, [hasPermission, hasRole, isPlatformAdmin]);

  const canMutateSelectedInvoice = useMemo(() => {
    if (!selectedInvoice) return false;
    return canRunFinanceMutation(isFinanceMutationAuthorized, selectedInvoice.lifecycle);
  }, [isFinanceMutationAuthorized, selectedInvoice]);

  const analytics = useMemo(() => buildReceivablesAndMarginAnalytics(invoices), [invoices]);

  const executeMutation = useCallback(
    (action: FinanceMutationAction) => {
      if (!selectedInvoice) {
        setMutationState('blocked');
        return;
      }
      if (!canRunFinanceMutation(isFinanceMutationAuthorized, selectedInvoice.lifecycle)) {
        setMutationState('blocked');
        setPendingCompensatingWorkflowPath(getCompensatingWorkflowPath(selectedInvoice.id));
        return;
      }

      if (action === 'save_draft') {
        setMutationState('saved');
        return;
      }

      if (action === 'adjust_tax') {
        setTaxBreakdown((previous) =>
          previous.map((line) => {
            if (line.committed) return line;
            return { ...line, amount: Number((line.amount * 1.01).toFixed(2)) };
          })
        );
        setMutationState('saved');
        return;
      }

      setInvoices((previous) =>
        previous.map((invoice) =>
          invoice.id === selectedInvoice.id
            ? { ...invoice, lifecycle: 'committed' }
            : invoice
        )
      );
      setTaxBreakdown((previous) => previous.map((line) => ({ ...line, committed: true })));
      setJournalRows((previous) => previous.map((row) => ({ ...row, committed: true })));
      setMutationState('committed');
    },
    [isFinanceMutationAuthorized, selectedInvoice]
  );

  const toggleDiscrepancy = useCallback((id: string) => {
    setExpandedDiscrepancyId((previous) => (previous === id ? '' : id));
  }, []);

  return {
    invoices,
    selectedInvoice,
    selectedInvoiceId,
    setSelectedInvoiceId,
    taxBreakdown,
    journalRows,
    discrepancies,
    expandedDiscrepancyId,
    toggleDiscrepancy,
    mutationState,
    pendingCompensatingWorkflowPath,
    analytics,
    isFinanceMutationAuthorized,
    canMutateSelectedInvoice,
    executeMutation,
    isImmutableFinanceRecord,
  };
}
