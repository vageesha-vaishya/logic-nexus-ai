import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Keyboard, MoreHorizontal, Plus, QrCode, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AmroKpiGrid, AmroModuleSurface, AmroStandardToolbar } from './AmroPartsUiStandards';
import { AmroHeaderCell, amroCompactTableClassNames } from './amroTableStandards';
import { AmroCrudDialogFooter, AmroCrudMessageBanner, AmroCrudSection } from './AmroCrudPrimitives';
import { AmroModuleGridDetailPanel } from './AmroModuleGridDetailPanel';
import {
  createStockLedgerBatch,
  buildBatchRetryPayload,
  createStockLedgerScheduledExport,
  createStockLedgerRecord,
  closeStockLedgerPeriod,
  decideStockLedgerApproval,
  exportStockLedgerEvidenceBundle,
  exportStockLedgerAudit,
  exportStockLedgerReport,
  getStockLedgerComplianceDashboard,
  getStockLedgerCurrencyDashboard,
  listStockLedgerApprovals,
  getStockLedgerDashboardKpis,
  listStockLedgerReportTemplates,
  listStockLedgerScheduledExports,
  listStockLedgerPeriods,
  openStockLedgerPeriod,
  requestReopenStockLedgerPeriod,
  reopenStockLedgerPeriod,
  runStockLedgerScheduledExportNow,
  listStockLedgerRecords,
  runStockLedgerReconciliation,
  saveStockLedgerReportTemplate,
  submitStockLedgerScanPosting,
  type StockLedgerCreatePayload,
  type StockLedgerApproval,
  type StockLedgerBatchReject,
  type StockLedgerComplianceDashboard,
  type StockLedgerCurrencyDashboard,
  type StockLedgerMovementType,
  type StockLedgerPeriod,
  type StockLedgerRecord,
  type StockLedgerDashboardKpis,
  type StockLedgerReportTemplate,
  type StockLedgerScheduledExport,
} from './stockLedgerApi';
import type { AmroApiScope } from './livePartsCatalogApi';

type Props = {
  apiScope?: AmroApiScope;
};

const MOVEMENT_TYPES: StockLedgerMovementType[] = [
  'receipt',
  'issue',
  'consume',
  'reserve',
  'release',
  'adjustment',
  'transfer_in',
  'transfer_out',
  'return',
];

function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildDefaultPeriodForm(): {
  periodCode: string;
  periodStart: string;
  periodEnd: string;
  valuationMethod: 'weighted_average';
  notes: string;
} {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    periodCode: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    periodStart: toIsoDate(start),
    periodEnd: toIsoDate(end),
    valuationMethod: 'weighted_average',
    notes: '',
  };
}

const EMPTY_FORM: StockLedgerCreatePayload = {
  partInventoryId: '',
  movementType: 'adjustment',
  valuationMethod: 'weighted_average',
  quantityDelta: 0,
  unitCost: 0,
  currency: 'USD',
  sourceModule: 'amro_parts',
  sourceReference: '',
  notes: '',
  metadata: {},
};

export function AmroStockLedgerPanel({ apiScope = {} }: Props): JSX.Element {
  const [records, setRecords] = useState<StockLedgerRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState('all');
  const [refreshTick, setRefreshTick] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formValue, setFormValue] = useState<StockLedgerCreatePayload>({ ...EMPTY_FORM });
  const [batchMode, setBatchMode] = useState(false);
  const [batchJson, setBatchJson] = useState('[\n  {\n    "partInventoryId": "",\n    "movementType": "receipt",\n    "quantityDelta": 1,\n    "unitCost": 0,\n    "currency": "USD"\n  }\n]');
  const [periods, setPeriods] = useState<StockLedgerPeriod[]>([]);
  const [approvals, setApprovals] = useState<StockLedgerApproval[]>([]);
  const [dashboardKpis, setDashboardKpis] = useState<StockLedgerDashboardKpis | null>(null);
  const [complianceKpis, setComplianceKpis] = useState<StockLedgerComplianceDashboard | null>(null);
  const [currencyKpis, setCurrencyKpis] = useState<StockLedgerCurrencyDashboard | null>(null);
  const [reportTemplates, setReportTemplates] = useState<StockLedgerReportTemplate[]>([]);
  const [scheduledExports, setScheduledExports] = useState<StockLedgerScheduledExport[]>([]);
  const [batchRejects, setBatchRejects] = useState<StockLedgerBatchReject[]>([]);
  const [scanMode, setScanMode] = useState<'barcode' | 'rfid' | 'manual'>('barcode');
  const [scanEventType, setScanEventType] = useState<'receive' | 'issue' | 'transfer' | 'audit' | 'reserve' | 'release'>('receive');
  const [scanCode, setScanCode] = useState('');
  const [scanQuantity, setScanQuantity] = useState(1);
  const [cycleExpectedQty, setCycleExpectedQty] = useState(0);
  const [cycleCountedQty, setCycleCountedQty] = useState(0);
  const [cyclePartInventoryId, setCyclePartInventoryId] = useState('');
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateType, setNewTemplateType] = useState<'stock-balance' | 'transaction-history' | 'valuation-summary'>('stock-balance');
  const [selectedTemplateForSchedule, setSelectedTemplateForSchedule] = useState('');
  const [selectedScheduleFrequency, setSelectedScheduleFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [periodForm, setPeriodForm] = useState(buildDefaultPeriodForm);
  const [periodCloseNote, setPeriodCloseNote] = useState('');
  const [selectedPeriodForClose, setSelectedPeriodForClose] = useState('');
  const [selectedPeriodForReopenRequest, setSelectedPeriodForReopenRequest] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [selectedApprovalDecision, setSelectedApprovalDecision] = useState<'approved' | 'rejected'>('approved');
  const [selectedApprovalId, setSelectedApprovalId] = useState('');
  const [selectedPeriodForReopenExecute, setSelectedPeriodForReopenExecute] = useState('');
  const [selectedApprovalForReopenExecute, setSelectedApprovalForReopenExecute] = useState('');
  const [opsTab, setOpsTab] = useState<'periods' | 'approvals' | 'automation' | 'cycle_count' | 'compliance'>('periods');
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);

  const loadRecords = useCallback(async (loadMore = false) => {
    setLoading(true);
    setError(null);
    try {
      const currentCursor = loadMore ? cursor : null;
      const response = await listStockLedgerRecords(
        {
          page: 1,
          pageSize: 50,
          movementType: movementTypeFilter,
          search,
          cursor: currentCursor ?? undefined,
        },
        fetch,
        apiScope,
      );
      setRecords((prev) => loadMore ? [...prev, ...response.records] : response.records);
      if (!loadMore) {
        setSelectedRecordId((current) => current || response.records[0]?.id || null);
      }
      setTotal(response.total);
      setHasNextPage(response.hasNextPage);
      setCursor(response.nextCursor);
      const [periodList, approvalList, kpis, templates, schedules, compliance, currency] = await Promise.all([
        listStockLedgerPeriods(fetch, apiScope),
        listStockLedgerApprovals('pending', fetch, apiScope),
        getStockLedgerDashboardKpis(fetch, apiScope),
        listStockLedgerReportTemplates(fetch, apiScope),
        listStockLedgerScheduledExports(fetch, apiScope),
        getStockLedgerComplianceDashboard(fetch, apiScope),
        getStockLedgerCurrencyDashboard('USD', fetch, apiScope),
      ]);
      setPeriods(periodList);
      setApprovals(approvalList);
      setDashboardKpis(kpis);
      setReportTemplates(templates);
      setScheduledExports(schedules);
      setComplianceKpis(compliance);
      setCurrencyKpis(currency);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load stock ledger records';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [apiScope, movementTypeFilter, search, cursor]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords, refreshTick]);

  const totalMovementValue = useMemo(() => records.reduce((sum, row) => sum + Number(row.totalCost || 0), 0), [records]);
  const totalMovementQuantity = useMemo(() => records.reduce((sum, row) => sum + Number(row.quantityDelta || 0), 0), [records]);

  const createSingle = useCallback(async () => {
    setSaving(true);
    try {
      if (!formValue.partInventoryId.trim()) throw new Error('Part Inventory ID is required');
      if (!Number.isFinite(formValue.quantityDelta) || formValue.quantityDelta === 0) {
        throw new Error('Quantity Delta must be a non-zero number');
      }
      await createStockLedgerRecord(formValue, fetch, apiScope);
      toast.success('Stock ledger transaction created');
      setDialogOpen(false);
      setFormValue({ ...EMPTY_FORM });
      setRefreshTick((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create stock ledger transaction');
    } finally {
      setSaving(false);
    }
  }, [apiScope, formValue]);

  const createBatch = useCallback(async () => {
    setSaving(true);
    try {
      const entries = JSON.parse(batchJson);
      if (!Array.isArray(entries)) throw new Error('Batch payload must be a JSON array');
      const payload = entries as StockLedgerCreatePayload[];
      const result = await createStockLedgerBatch(payload, fetch, apiScope);
      setBatchRejects(result.rejected);
      toast.success(`Batch created. created=${result.createdCount}, rejected=${result.rejectedCount}`);
      if (result.rejectedCount === 0) setDialogOpen(false);
      setRefreshTick((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create stock ledger batch');
    } finally {
      setSaving(false);
    }
  }, [apiScope, batchJson]);

  const runReconciliation = useCallback(async () => {
    try {
      const result = await runStockLedgerReconciliation(fetch, apiScope);
      toast.success(`Reconciliation complete. run=${result.runId}, variances=${result.varianceItems}`);
      setRefreshTick((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to run reconciliation');
    }
  }, [apiScope]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const hotkey = event.ctrlKey || event.metaKey;
      if (!hotkey) return;
      if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        setDialogOpen(true);
      }
      if (event.key.toLowerCase() === 'r' && event.shiftKey) {
        event.preventDefault();
        void runReconciliation();
      } else if (event.key.toLowerCase() === 'r') {
        event.preventDefault();
        setRefreshTick((value) => value + 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [runReconciliation]);

  const exportReport = useCallback(async (reportType: 'stock-balance' | 'transaction-history' | 'valuation-summary') => {
    try {
      const csv = await exportStockLedgerReport(reportType, fetch, apiScope);
      if (!csv) {
        toast.info(`No rows returned for ${reportType}`);
        return;
      }
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `amro-${reportType}-${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`${reportType} exported`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to export ${reportType}`);
    }
  }, [apiScope]);

  const exportAudit = useCallback(async () => {
    try {
      const csv = await exportStockLedgerAudit(fetch, apiScope);
      if (!csv) {
        toast.info('No rows returned for audit export');
        return;
      }
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `amro-stock-ledger-audit-${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Audit exported');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to export audit');
    }
  }, [apiScope]);

  const createPeriod = useCallback(async () => {
    try {
      if (!periodForm.periodCode.trim() || !periodForm.periodStart || !periodForm.periodEnd) {
        toast.error('Period code, start date, and end date are required');
        return;
      }
      await openStockLedgerPeriod(periodForm, fetch, apiScope);
      toast.success(`Period ${periodForm.periodCode} opened`);
      setPeriodForm(buildDefaultPeriodForm());
      setRefreshTick((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to open period');
    }
  }, [apiScope, periodForm]);

  const closePeriod = useCallback(async () => {
    try {
      if (!selectedPeriodForClose) throw new Error('Select period to close');
      await closeStockLedgerPeriod(selectedPeriodForClose, periodCloseNote, fetch, apiScope);
      toast.success('Period closed');
      setPeriodCloseNote('');
      setSelectedPeriodForClose('');
      setRefreshTick((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to close period');
    }
  }, [apiScope, periodCloseNote, selectedPeriodForClose]);

  const createReopenRequest = useCallback(async () => {
    try {
      if (!selectedPeriodForReopenRequest) throw new Error('Select period for reopen request');
      await requestReopenStockLedgerPeriod(selectedPeriodForReopenRequest, reopenReason, fetch, apiScope);
      toast.success('Reopen request submitted');
      setSelectedPeriodForReopenRequest('');
      setReopenReason('');
      setRefreshTick((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to request reopen');
    }
  }, [apiScope, reopenReason, selectedPeriodForReopenRequest]);

  const decideApproval = useCallback(async () => {
    try {
      if (!selectedApprovalId) throw new Error('Select approval request');
      await decideStockLedgerApproval(selectedApprovalId, selectedApprovalDecision, '', fetch, apiScope);
      toast.success(`Approval ${selectedApprovalDecision}`);
      setSelectedApprovalId('');
      setRefreshTick((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to decide approval');
    }
  }, [apiScope, selectedApprovalDecision, selectedApprovalId]);

  const executeReopen = useCallback(async () => {
    try {
      if (!selectedPeriodForReopenExecute || !selectedApprovalForReopenExecute) {
        throw new Error('Select period and approved request');
      }
      await reopenStockLedgerPeriod(selectedPeriodForReopenExecute, selectedApprovalForReopenExecute, fetch, apiScope);
      toast.success('Period reopened');
      setSelectedPeriodForReopenExecute('');
      setSelectedApprovalForReopenExecute('');
      setRefreshTick((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reopen period');
    }
  }, [apiScope, selectedApprovalForReopenExecute, selectedPeriodForReopenExecute]);

  const saveReportTemplate = useCallback(async () => {
    try {
      if (!newTemplateName.trim()) throw new Error('Template name is required');
      const saved = await saveStockLedgerReportTemplate({
        name: newTemplateName.trim(),
        report_type: newTemplateType,
      }, fetch, apiScope);
      setReportTemplates((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)]);
      setNewTemplateName('');
      toast.success('Report template saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save report template');
    }
  }, [apiScope, newTemplateName, newTemplateType]);

  const createSchedule = useCallback(async () => {
    try {
      if (!selectedTemplateForSchedule) throw new Error('Select template for schedule');
      const schedule = await createStockLedgerScheduledExport({
        template_id: selectedTemplateForSchedule,
        frequency: selectedScheduleFrequency,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      }, fetch, apiScope);
      setScheduledExports((prev) => [schedule, ...prev.filter((item) => item.id !== schedule.id)]);
      toast.success('Scheduled export created');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create schedule');
    }
  }, [apiScope, selectedTemplateForSchedule, selectedScheduleFrequency]);

  const executeSchedule = useCallback(async (scheduleId: string) => {
    try {
      const updated = await runStockLedgerScheduledExportNow(scheduleId, fetch, apiScope);
      setScheduledExports((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      toast.success('Scheduled export executed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to execute scheduled export');
    }
  }, [apiScope]);

  const exportEvidenceBundle = useCallback(async (format: 'json' | 'csv') => {
    try {
      const content = await exportStockLedgerEvidenceBundle(format, fetch, apiScope);
      if (!content) {
        toast.info('No evidence rows available');
        return;
      }
      const blob = new Blob([content], { type: format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `amro-stock-ledger-evidence-${Date.now()}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Evidence bundle exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to export evidence bundle');
    }
  }, [apiScope]);

  const runScanPosting = useCallback(async () => {
    try {
      if (!scanCode.trim()) throw new Error('Scan code is required');
      if (!Number.isFinite(scanQuantity) || scanQuantity <= 0) throw new Error('Scan quantity must be > 0');
      await submitStockLedgerScanPosting({
        scanMode,
        eventType: scanEventType,
        scanCode: scanCode.trim(),
        quantity: scanQuantity,
      }, fetch, apiScope);
      toast.success('Scan posting processed');
      setScanCode('');
      setScanQuantity(1);
      setRefreshTick((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to process scan posting');
    }
  }, [apiScope, scanCode, scanEventType, scanMode, scanQuantity]);

  const submitCycleCount = useCallback(async () => {
    try {
      if (!cyclePartInventoryId.trim()) throw new Error('Part Inventory ID is required');
      const delta = Number(cycleCountedQty) - Number(cycleExpectedQty);
      if (!Number.isFinite(delta) || delta === 0) throw new Error('No discrepancy to post');
      await createStockLedgerRecord({
        partInventoryId: cyclePartInventoryId.trim(),
        movementType: 'adjustment',
        valuationMethod: 'weighted_average',
        quantityDelta: delta,
        unitCost: 0,
        currency: 'USD',
        sourceModule: 'inventory_adjustment',
        sourceReference: `ADJ-${Date.now()}`,
        notes: `Cycle count discrepancy posted. expected=${cycleExpectedQty}, counted=${cycleCountedQty}`,
        metadata: {
          p2_cycle_count: true,
          expected_quantity: cycleExpectedQty,
          counted_quantity: cycleCountedQty,
        },
      }, fetch, apiScope);
      toast.success('Cycle count discrepancy posted');
      setRefreshTick((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to post cycle count discrepancy');
    }
  }, [apiScope, cycleCountedQty, cycleExpectedQty, cyclePartInventoryId]);

  const downloadRejectedBatch = useCallback(() => {
    if (batchRejects.length === 0) {
      toast.info('No rejected entries available');
      return;
    }
    const content = JSON.stringify(batchRejects, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `amro-stock-ledger-batch-rejected-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Rejected diagnostics downloaded');
  }, [batchRejects]);

  const retryRejectedBatch = useCallback(async () => {
    try {
      const retryEntries = buildBatchRetryPayload(batchRejects);
      if (retryEntries.length === 0) throw new Error('No retryable rejected entries available');
      const result = await createStockLedgerBatch(retryEntries, fetch, apiScope);
      setBatchRejects(result.rejected);
      toast.success(`Retry completed. created=${result.createdCount}, rejected=${result.rejectedCount}`);
      setRefreshTick((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to retry rejected batch entries');
    }
  }, [apiScope, batchRejects]);

  return (
    <div className="mt-4 space-y-3">
      <AmroModuleSurface
        title="Stock Ledger"
        subtitle="Real-time stock movement tracking, valuation behavior, and period governance."
        moduleId="inventory-core.stock-ledger"
        status={loading ? 'loading' : 'ready'}
      >
        <AmroStandardToolbar
          searchValue={search}
          onSearchChange={setSearch}
          placeholder="Search source, reference, notes..."
          leftActions={(
            <Select value={movementTypeFilter} onValueChange={setMovementTypeFilter}>
              <SelectTrigger className="h-8 w-[180px]"><SelectValue placeholder="Movement Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {MOVEMENT_TYPES.map((movementType) => (
                  <SelectItem key={movementType} value={movementType}>{movementType}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          rightActions={(
            <>
              <Button type="button" size="sm" variant="outline" className="hidden h-8 md:inline-flex" onClick={() => setRefreshTick((value) => value + 1)}>
                <RefreshCw className="mr-1 h-4 w-4" />
                Refresh
              </Button>
              <Button type="button" size="sm" variant="outline" className="hidden h-8 md:inline-flex" onClick={() => { void runReconciliation(); }}>
                <ShieldCheck className="mr-1 h-4 w-4" />
                Reconcile
              </Button>
              <Button type="button" size="sm" variant="outline" className="hidden h-8 lg:inline-flex" onClick={() => { void exportReport('stock-balance'); }}>
                <Download className="mr-1 h-4 w-4" />
                Export Balance
              </Button>
              <Button type="button" size="sm" variant="outline" className="hidden h-8 lg:inline-flex" onClick={() => { void exportReport('valuation-summary'); }}>
                <Download className="mr-1 h-4 w-4" />
                Export Valuation
              </Button>
              <Button type="button" size="sm" variant="outline" className="hidden h-8 lg:inline-flex" onClick={() => { void exportAudit(); }}>
                <Download className="mr-1 h-4 w-4" />
                Export Audit
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="sm" variant="outline" className="h-8">
                    <MoreHorizontal className="mr-1 h-4 w-4" />
                    More Actions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setRefreshTick((value) => value + 1)}>Refresh</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { void runReconciliation(); }}>Run Reconciliation</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { void exportReport('stock-balance'); }}>Export Balance</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { void exportReport('valuation-summary'); }}>Export Valuation</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { void exportAudit(); }}>Export Audit</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { void exportEvidenceBundle('csv'); }}>Export Evidence (CSV)</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { void exportEvidenceBundle('json'); }}>Export Evidence (JSON)</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    toast.info('Keyboard map: Ctrl/Cmd+N New, Ctrl/Cmd+R Refresh, Ctrl/Cmd+Shift+R Reconcile');
                  }}>
                    <Keyboard className="mr-2 h-4 w-4" />
                    Keyboard Map
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button type="button" size="sm" className="h-8" onClick={() => setDialogOpen(true)}>
                <Plus className="mr-1 h-4 w-4" />
                New Transaction
              </Button>
            </>
          )}
        />
        <AmroKpiGrid
          items={[
            { label: 'Records', value: String(total) },
            { label: 'Net Quantity Delta', value: totalMovementQuantity.toFixed(2), tone: totalMovementQuantity < 0 ? 'warning' : 'success' },
            { label: 'Movement Value', value: totalMovementValue.toFixed(2) },
            { label: 'Pending Approvals', value: String(dashboardKpis?.pendingApprovals ?? 0), tone: (dashboardKpis?.pendingApprovals ?? 0) > 0 ? 'warning' : 'success' },
            { label: 'SLA Breaches', value: String(dashboardKpis?.pendingApprovalSlaBreaches ?? 0), tone: (dashboardKpis?.pendingApprovalSlaBreaches ?? 0) > 0 ? 'warning' : 'success' },
            { label: 'Unresolved Variances', value: String(dashboardKpis?.unresolvedVarianceItems ?? 0), tone: (dashboardKpis?.unresolvedVarianceItems ?? 0) > 0 ? 'warning' : 'success' },
            { label: 'Open Period Age (h)', value: (dashboardKpis?.openPeriodAgeHours ?? 0).toFixed(1), tone: (dashboardKpis?.openPeriodAgeHours ?? 0) > 48 ? 'warning' : 'default' },
            { label: 'Inventory Value', value: (dashboardKpis?.totalInventoryValue ?? 0).toFixed(2) },
          ]}
        />
        <AmroCrudMessageBanner message={error} tone="error" />
        <AmroModuleGridDetailPanel
          rows={records}
          loading={loading}
          emptyMessage="No stock ledger records."
          selectedId={selectedRecordId}
          onSelect={setSelectedRecordId}
          detailTitle="Transaction Detail"
          columns={[
            { key: 'effectiveAt', label: 'Effective At', render: (row) => row.effectiveAt ? new Date(row.effectiveAt).toLocaleString() : '-' },
            { key: 'partInventoryId', label: 'Part ID', render: (row) => row.partInventoryId },
            { key: 'movementType', label: 'Type', render: (row) => <Badge variant="outline">{row.movementType}</Badge> },
            { key: 'quantityDelta', label: 'Delta', render: (row) => row.quantityDelta.toFixed(2) },
            { key: 'balanceAfter', label: 'Balance', render: (row) => row.balanceAfter === null ? '-' : row.balanceAfter.toFixed(2) },
            { key: 'valuationMethod', label: 'Valuation', render: (row) => row.valuationMethod },
            { key: 'totalCost', label: 'Cost', render: (row) => `${row.totalCost.toFixed(2)} ${row.currency}` },
          ]}
          renderDetail={(row) => (
            !row ? <p className="text-xs text-muted-foreground">Select a transaction row to inspect details.</p> : (
              <div className="space-y-1 text-xs">
                <p><span className="font-semibold">Part ID:</span> {row.partInventoryId}</p>
                <p><span className="font-semibold">Movement Type:</span> {row.movementType}</p>
                <p><span className="font-semibold">Quantity Delta:</span> {row.quantityDelta.toFixed(2)}</p>
                <p><span className="font-semibold">Balance After:</span> {row.balanceAfter === null ? '-' : row.balanceAfter.toFixed(2)}</p>
                <p><span className="font-semibold">Valuation:</span> {row.valuationMethod}</p>
                <p><span className="font-semibold">Total Cost:</span> {row.totalCost.toFixed(2)} {row.currency}</p>
                <p><span className="font-semibold">Source:</span> {row.sourceReference || row.sourceModule || '-'}</p>
                {row.notes ? <p><span className="font-semibold">Notes:</span> {row.notes}</p> : null}
              </div>
            )
          )}
        />
        {hasNextPage && (
          <div className="flex justify-center pt-3">
            <Button size="sm" variant="outline" onClick={() => { void loadRecords(true); }} disabled={loading}>
              {loading ? 'Loading...' : `Load More (${records.length} of ${total} loaded)`}
            </Button>
          </div>
        )}

        {error ? (
          <div className="rounded border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive" role="alert" aria-live="assertive">
            <p className="font-semibold">Error Summary</p>
            <p>{error}</p>
            <p className="mt-1 text-xs text-destructive/80">Use keyboard shortcuts: <span className="font-mono">Ctrl/Cmd+R</span> refresh, <span className="font-mono">Ctrl/Cmd+N</span> new transaction.</p>
          </div>
        ) : null}

        <Tabs value={opsTab} onValueChange={(value) => setOpsTab(value as 'periods' | 'approvals' | 'automation' | 'cycle_count' | 'compliance')} className="mt-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="periods">Period Controls</TabsTrigger>
            <TabsTrigger value="approvals">Approval Queue</TabsTrigger>
            <TabsTrigger value="automation">Automation</TabsTrigger>
            <TabsTrigger value="cycle_count">Cycle + Scan</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
          </TabsList>
          <TabsContent value="periods" className="pt-3">
            <AmroCrudSection title="Period Controls">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Input placeholder="Period code (e.g. 2026-04)" value={periodForm.periodCode} onChange={(event) => setPeriodForm((prev) => ({ ...prev, periodCode: event.target.value }))} />
              <Select value={periodForm.valuationMethod} onValueChange={(value) => setPeriodForm((prev) => ({ ...prev, valuationMethod: value as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fifo">fifo</SelectItem>
                  <SelectItem value="lifo">lifo</SelectItem>
                  <SelectItem value="weighted_average">weighted_average</SelectItem>
                </SelectContent>
              </Select>
              <Input type="date" value={periodForm.periodStart} onChange={(event) => setPeriodForm((prev) => ({ ...prev, periodStart: event.target.value }))} />
              <Input type="date" value={periodForm.periodEnd} onChange={(event) => setPeriodForm((prev) => ({ ...prev, periodEnd: event.target.value }))} />
            </div>
            <Input className="mt-2" placeholder="Open period notes" value={periodForm.notes} onChange={(event) => setPeriodForm((prev) => ({ ...prev, notes: event.target.value }))} />
            <Button className="mt-2" size="sm" onClick={() => { void createPeriod(); }}>Open Period</Button>
            <div className="mt-3 max-h-40 overflow-auto rounded border">
              <table className={amroCompactTableClassNames.table}>
                <thead className={amroCompactTableClassNames.thead}><tr><AmroHeaderCell compact>Code</AmroHeaderCell><AmroHeaderCell compact>Window</AmroHeaderCell><AmroHeaderCell compact>Status</AmroHeaderCell></tr></thead>
                <tbody>
                  {periods.map((period) => (
                    <tr key={period.id} className={amroCompactTableClassNames.row}>
                      <td className={amroCompactTableClassNames.td}>{period.period_code}</td>
                      <td className={amroCompactTableClassNames.td}>{period.period_start} to {period.period_end}</td>
                      <td className={amroCompactTableClassNames.td}><Badge variant="outline">{period.close_status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              <Select value={selectedPeriodForClose} onValueChange={setSelectedPeriodForClose}>
                <SelectTrigger><SelectValue placeholder="Select period to close" /></SelectTrigger>
                <SelectContent>{periods.map((period) => <SelectItem key={`close-${period.id}`} value={period.id}>{period.period_code}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="Close notes" value={periodCloseNote} onChange={(event) => setPeriodCloseNote(event.target.value)} />
            </div>
            <Button className="mt-2" size="sm" variant="outline" onClick={() => { void closePeriod(); }}>Close Period</Button>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              <Select value={selectedPeriodForReopenRequest} onValueChange={setSelectedPeriodForReopenRequest}>
                <SelectTrigger><SelectValue placeholder="Period reopen request" /></SelectTrigger>
                <SelectContent>{periods.map((period) => <SelectItem key={`reopen-${period.id}`} value={period.id}>{period.period_code}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="Reopen reason" value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} />
            </div>
            <Button className="mt-2" size="sm" variant="outline" onClick={() => { void createReopenRequest(); }}>Request Reopen</Button>
            </AmroCrudSection>
          </TabsContent>
          <TabsContent value="approvals" className="pt-3">
            <AmroCrudSection title="Approval Queue">
            <div className="max-h-48 overflow-auto rounded border">
              <table className={amroCompactTableClassNames.table}>
                <thead className={amroCompactTableClassNames.thead}><tr><AmroHeaderCell compact>Type</AmroHeaderCell><AmroHeaderCell compact>Status</AmroHeaderCell><AmroHeaderCell compact>Period</AmroHeaderCell></tr></thead>
                <tbody>
                  {approvals.map((approval) => (
                    <tr key={approval.id} className={amroCompactTableClassNames.row}>
                      <td className={amroCompactTableClassNames.td}>{approval.request_type}</td>
                      <td className={amroCompactTableClassNames.td}><Badge variant="outline">{approval.request_status}</Badge></td>
                      <td className={amroCompactTableClassNames.td}>{approval.related_period_id || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              <Select value={selectedApprovalId} onValueChange={setSelectedApprovalId}>
                <SelectTrigger><SelectValue placeholder="Select approval request" /></SelectTrigger>
                <SelectContent>{approvals.map((approval) => <SelectItem key={`approval-${approval.id}`} value={approval.id}>{approval.request_type} ({approval.id.slice(0, 8)})</SelectItem>)}</SelectContent>
              </Select>
              <Select value={selectedApprovalDecision} onValueChange={(value) => setSelectedApprovalDecision(value as 'approved' | 'rejected')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">approved</SelectItem>
                  <SelectItem value="rejected">rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="mt-2" size="sm" variant="outline" onClick={() => { void decideApproval(); }}>Submit Decision</Button>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              <Select value={selectedPeriodForReopenExecute} onValueChange={setSelectedPeriodForReopenExecute}>
                <SelectTrigger><SelectValue placeholder="Period to reopen" /></SelectTrigger>
                <SelectContent>{periods.map((period) => <SelectItem key={`exec-period-${period.id}`} value={period.id}>{period.period_code}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={selectedApprovalForReopenExecute} onValueChange={setSelectedApprovalForReopenExecute}>
                <SelectTrigger><SelectValue placeholder="Approved reopen request" /></SelectTrigger>
                <SelectContent>{approvals.filter((approval) => approval.request_type === 'period_reopen').map((approval) => <SelectItem key={`exec-approval-${approval.id}`} value={approval.id}>{approval.id.slice(0, 8)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button className="mt-2" size="sm" variant="outline" onClick={() => { void executeReopen(); }}>Execute Reopen</Button>
            </AmroCrudSection>
          </TabsContent>
          <TabsContent value="automation" className="pt-3">
            <AmroCrudSection title="Reporting Automation">
              <div className="space-y-4">
                <div className="rounded-md border p-3">
                  <h4 className="text-sm font-medium">Save Report Template</h4>
                  <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                    <Input
                      placeholder="Template name (e.g. Monthly Reconciliation)"
                      value={newTemplateName}
                      onChange={(event) => setNewTemplateName(event.target.value)}
                    />
                    <Select value={newTemplateType} onValueChange={(value) => setNewTemplateType(value as 'stock-balance' | 'transaction-history' | 'valuation-summary')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="stock-balance">Stock Balance</SelectItem>
                        <SelectItem value="transaction-history">Transaction History</SelectItem>
                        <SelectItem value="valuation-summary">Valuation Summary</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={() => { void saveReportTemplate(); }} disabled={!newTemplateName.trim()}>
                      <Sparkles className="mr-1 h-4 w-4" />
                      Save Template
                    </Button>
                  </div>
                </div>

                <div className="rounded-md border p-3">
                  <h4 className="text-sm font-medium">Saved Templates ({reportTemplates.length})</h4>
                  <div className="mt-2 rounded border">
                    <table className={amroCompactTableClassNames.table}>
                      <thead className={amroCompactTableClassNames.thead}><tr><AmroHeaderCell compact>Name</AmroHeaderCell><AmroHeaderCell compact>Type</AmroHeaderCell><AmroHeaderCell compact>Last Updated</AmroHeaderCell></tr></thead>
                      <tbody>
                        {reportTemplates.length === 0 ? (
                          <tr><td colSpan={3} className="p-3 text-center text-sm text-muted-foreground">No saved templates yet</td></tr>
                        ) : reportTemplates.map((template) => (
                          <tr key={template.id} className={amroCompactTableClassNames.row}>
                            <td className={amroCompactTableClassNames.td}>{template.name}</td>
                            <td className={amroCompactTableClassNames.td}>{template.report_type}</td>
                            <td className={amroCompactTableClassNames.td}>{new Date(template.updated_at).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-md border p-3">
                  <h4 className="text-sm font-medium">Schedule Automated Export</h4>
                  <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                    <Select value={selectedTemplateForSchedule} onValueChange={setSelectedTemplateForSchedule}>
                      <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
                      <SelectContent>
                        {reportTemplates.length === 0 ? (
                          <SelectItem value="__none__" disabled>No templates available</SelectItem>
                        ) : reportTemplates.map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={selectedScheduleFrequency} onValueChange={(value) => setSelectedScheduleFrequency(value as 'daily' | 'weekly' | 'monthly')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" onClick={() => { void createSchedule(); }} disabled={!selectedTemplateForSchedule || selectedTemplateForSchedule === '__none__'}>Create Schedule</Button>
                  </div>
                </div>

                <div className="rounded-md border p-3">
                  <h4 className="text-sm font-medium">Scheduled Exports ({scheduledExports.length})</h4>
                  {scheduledExports.length === 0 ? (
                    <p className="mt-2 text-center text-sm text-muted-foreground">No scheduled exports configured</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {scheduledExports.map((schedule) => (
                        <div key={schedule.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-xs">
                          <div>
                            <span className="font-medium">{schedule.frequency}</span>
                            {' · '}Next run: <span className="text-muted-foreground">{new Date(schedule.next_run_at).toLocaleString()}</span>
                            {' · '}Template: <span className="font-mono">{schedule.template_id.slice(0, 8)}...</span>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => { void executeSchedule(schedule.id); }}>Run Now</Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </AmroCrudSection>
          </TabsContent>
          <TabsContent value="cycle_count" className="pt-3">
            <AmroCrudSection title="Cycle Counting">
              <div className="space-y-3">
                <div className="rounded-md border p-3">
                  <h4 className="text-sm font-medium">Post Cycle Count Discrepancy</h4>
                  <p className="mt-1 text-xs text-muted-foreground">Compare physical count against ledger and post an adjustment if there is a discrepancy.</p>
                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
                    <div className="space-y-1">
                      <Label className="text-xs">Part Inventory ID</Label>
                      <Input placeholder="e.g. part-uuid-here" value={cyclePartInventoryId} onChange={(event) => setCyclePartInventoryId(event.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Expected Qty (System)</Label>
                      <Input type="number" placeholder="0" value={String(cycleExpectedQty)} onChange={(event) => setCycleExpectedQty(Number(event.target.value || 0))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Counted Qty (Physical)</Label>
                      <Input type="number" placeholder="0" value={String(cycleCountedQty)} onChange={(event) => setCycleCountedQty(Number(event.target.value || 0))} />
                    </div>
                    <div className="flex items-end">
                      <Button size="sm" onClick={() => { void submitCycleCount(); }} disabled={!cyclePartInventoryId.trim() || cycleCountedQty === cycleExpectedQty}>
                        <ShieldCheck className="mr-1 h-4 w-4" />
                        Post Adjustment
                      </Button>
                    </div>
                  </div>
                  {cyclePartInventoryId && cycleCountedQty !== cycleExpectedQty && (
                    <div className="mt-2 text-xs">
                      <span className={Number(cycleCountedQty) - Number(cycleExpectedQty) > 0 ? 'text-green-600' : 'text-red-600'}>
                        Discrepancy: {Number(cycleCountedQty) - Number(cycleExpectedQty) > 0 ? '+' : ''}{Number(cycleCountedQty) - Number(cycleExpectedQty)} units
                      </span>
                    </div>
                  )}
                </div>

                <div className="rounded-md border p-3">
                  <h4 className="text-sm font-medium">Scan-Assisted Posting</h4>
                  <p className="mt-1 text-xs text-muted-foreground">Use barcode or RFID scanner to capture stock movements directly.</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
                    <div className="space-y-1">
                      <Label className="text-xs">Scan Mode</Label>
                      <Select value={scanMode} onValueChange={(value) => setScanMode(value as 'barcode' | 'rfid' | 'manual')}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="barcode">🔲 Barcode</SelectItem>
                          <SelectItem value="rfid">📡 RFID</SelectItem>
                          <SelectItem value="manual">⌨️ Manual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Event Type</Label>
                      <Select value={scanEventType} onValueChange={(value) => setScanEventType(value as 'receive' | 'issue' | 'transfer' | 'audit' | 'reserve' | 'release')}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="receive">📥 Receive</SelectItem>
                          <SelectItem value="issue">📤 Issue</SelectItem>
                          <SelectItem value="transfer">🔄 Transfer</SelectItem>
                          <SelectItem value="audit">🔍 Audit</SelectItem>
                          <SelectItem value="reserve">🔒 Reserve</SelectItem>
                          <SelectItem value="release">🔓 Release</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-xs">Scan Code / Reference</Label>
                      <Input
                        placeholder="Scan or enter code"
                        value={scanCode}
                        onChange={(event) => setScanCode(event.target.value)}
                        onKeyDown={(event) => { if (event.key === 'Enter') { void runScanPosting(); } }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Quantity</Label>
                      <Input type="number" placeholder="1" value={String(scanQuantity)} min={1} onChange={(event) => setScanQuantity(Math.max(1, Number(event.target.value || 1)))} />
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { void runScanPosting(); }} disabled={!scanCode.trim() || scanQuantity < 1}>
                      <QrCode className="mr-1 h-4 w-4" />
                      Process Scan
                    </Button>
                    <span className="text-xs text-muted-foreground self-center">
                      Mode: {scanMode} → Event: {scanEventType}
                    </span>
                  </div>
                </div>
              </div>
            </AmroCrudSection>
          </TabsContent>
          <TabsContent value="compliance" className="pt-3">
            <AmroCrudSection title="Compliance & Multi-currency">
              <AmroKpiGrid
                items={[
                  { label: 'Hash Coverage %', value: String((complianceKpis?.immutableHashCoveragePercent ?? 0).toFixed(2)), tone: (complianceKpis?.immutableHashCoveragePercent ?? 0) < 95 ? 'warning' : 'success' },
                  { label: 'Stale Approvals', value: String(complianceKpis?.staleApprovals ?? 0), tone: (complianceKpis?.staleApprovals ?? 0) > 0 ? 'warning' : 'success' },
                  { label: 'Open Periods', value: String(complianceKpis?.openPeriods ?? 0), tone: (complianceKpis?.openPeriods ?? 0) > 0 ? 'warning' : 'success' },
                  { label: 'Failed Recon Runs', value: String(complianceKpis?.failedReconciliationRuns ?? 0), tone: (complianceKpis?.failedReconciliationRuns ?? 0) > 0 ? 'warning' : 'success' },
                  { label: `FX Base (${currencyKpis?.baseCurrency || 'USD'})`, value: (currencyKpis?.totalBaseValue ?? 0).toFixed(2) },
                ]}
              />
              <div className="mt-2 rounded border">
                <table className={amroCompactTableClassNames.table}>
                  <thead className={amroCompactTableClassNames.thead}><tr><AmroHeaderCell compact>Currency</AmroHeaderCell><AmroHeaderCell compact>Raw Total</AmroHeaderCell><AmroHeaderCell compact>Base Total</AmroHeaderCell><AmroHeaderCell compact>Txn Count</AmroHeaderCell></tr></thead>
                  <tbody>
                    {(currencyKpis?.records || []).map((row) => (
                      <tr key={row.currency} className={amroCompactTableClassNames.row}>
                        <td className={amroCompactTableClassNames.td}>{row.currency}</td>
                        <td className={amroCompactTableClassNames.td}>{row.rawTotal.toFixed(2)}</td>
                        <td className={amroCompactTableClassNames.td}>{row.baseTotal.toFixed(2)}</td>
                        <td className={amroCompactTableClassNames.td}>{row.txnCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => { void exportEvidenceBundle('json'); }}>Download Evidence JSON</Button>
                <Button size="sm" variant="outline" onClick={() => { void exportEvidenceBundle('csv'); }}>Download Evidence CSV</Button>
              </div>
            </AmroCrudSection>
          </TabsContent>
        </Tabs>
      </AmroModuleSurface>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!saving) setDialogOpen(open); }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create Stock Ledger Transaction</DialogTitle>
          </DialogHeader>

          <div className="mb-2 flex items-center gap-2">
            <Button type="button" variant={batchMode ? 'outline' : 'default'} size="sm" onClick={() => setBatchMode(false)}>Single</Button>
            <Button type="button" variant={batchMode ? 'default' : 'outline'} size="sm" onClick={() => setBatchMode(true)}>Batch</Button>
          </div>

          {!batchMode ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1"><Label>Part Inventory ID</Label><Input value={formValue.partInventoryId} onChange={(event) => setFormValue((prev) => ({ ...prev, partInventoryId: event.target.value }))} /></div>
              <div className="space-y-1">
                <Label>Movement Type</Label>
                <Select value={formValue.movementType} onValueChange={(value) => setFormValue((prev) => ({ ...prev, movementType: value as StockLedgerMovementType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MOVEMENT_TYPES.map((movementType) => <SelectItem key={movementType} value={movementType}>{movementType}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Quantity Delta</Label><Input type="number" step="0.000001" value={String(formValue.quantityDelta)} onChange={(event) => setFormValue((prev) => ({ ...prev, quantityDelta: Number(event.target.value || 0) }))} /></div>
              <div className="space-y-1"><Label>Unit Cost</Label><Input type="number" step="0.000001" value={String(formValue.unitCost || 0)} onChange={(event) => setFormValue((prev) => ({ ...prev, unitCost: Number(event.target.value || 0) }))} /></div>
              <div className="space-y-1"><Label>Source Module</Label><Input value={formValue.sourceModule || ''} onChange={(event) => setFormValue((prev) => ({ ...prev, sourceModule: event.target.value }))} /></div>
              <div className="space-y-1"><Label>Source Reference</Label><Input value={formValue.sourceReference || ''} onChange={(event) => setFormValue((prev) => ({ ...prev, sourceReference: event.target.value }))} /></div>
              <div className="space-y-1 md:col-span-2"><Label>Notes</Label><Textarea rows={2} value={formValue.notes || ''} onChange={(event) => setFormValue((prev) => ({ ...prev, notes: event.target.value }))} /></div>
            </div>
          ) : (
            <div className="space-y-1">
              <Label>Batch JSON (array of entries)</Label>
              <Textarea rows={12} value={batchJson} onChange={(event) => setBatchJson(event.target.value)} />
              {batchRejects.length > 0 ? (
                <div className="mt-2 rounded border border-warning/40 bg-warning/5 p-2 text-xs">
                  <p className="font-semibold">Batch reject diagnostics</p>
                  <p>{batchRejects.length} rejected row(s) available for retry package generation.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" type="button" onClick={downloadRejectedBatch}>Download Reject JSON</Button>
                    <Button size="sm" variant="outline" type="button" onClick={() => { void retryRejectedBatch(); }}>Retry Rejected</Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <AmroCrudDialogFooter
            saving={saving}
            onCancel={() => setDialogOpen(false)}
            onConfirm={() => { void (batchMode ? createBatch() : createSingle()); }}
            confirmLabel={batchMode ? 'Create Batch' : 'Create Transaction'}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
