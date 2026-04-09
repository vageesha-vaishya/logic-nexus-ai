import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { AmroKpiGrid, AmroModuleSurface, AmroStandardToolbar } from './AmroPartsUiStandards';
import { AmroHeaderCell, amroCompactTableClassNames } from './amroTableStandards';
import { AmroCrudDialogFooter, AmroCrudMessageBanner, AmroCrudSection } from './AmroCrudPrimitives';
import { AmroModuleGridDetailPanel } from './AmroModuleGridDetailPanel';
import {
  createStockLedgerBatch,
  createStockLedgerRecord,
  closeStockLedgerPeriod,
  decideStockLedgerApproval,
  exportStockLedgerAudit,
  exportStockLedgerReport,
  listStockLedgerApprovals,
  listStockLedgerPeriods,
  openStockLedgerPeriod,
  requestReopenStockLedgerPeriod,
  reopenStockLedgerPeriod,
  listStockLedgerRecords,
  runStockLedgerReconciliation,
  type StockLedgerCreatePayload,
  type StockLedgerApproval,
  type StockLedgerMovementType,
  type StockLedgerPeriod,
  type StockLedgerRecord,
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
  const [periodForm, setPeriodForm] = useState(buildDefaultPeriodForm);
  const [periodCloseNote, setPeriodCloseNote] = useState('');
  const [selectedPeriodForClose, setSelectedPeriodForClose] = useState('');
  const [selectedPeriodForReopenRequest, setSelectedPeriodForReopenRequest] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [selectedApprovalDecision, setSelectedApprovalDecision] = useState<'approved' | 'rejected'>('approved');
  const [selectedApprovalId, setSelectedApprovalId] = useState('');
  const [selectedPeriodForReopenExecute, setSelectedPeriodForReopenExecute] = useState('');
  const [selectedApprovalForReopenExecute, setSelectedApprovalForReopenExecute] = useState('');
  const [opsTab, setOpsTab] = useState<'periods' | 'approvals'>('periods');

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listStockLedgerRecords(
        {
          page: 1,
          pageSize: 50,
          movementType: movementTypeFilter,
          search,
        },
        fetch,
        apiScope,
      );
      setRecords(response.records);
      setSelectedRecordId((current) => current || response.records[0]?.id || null);
      setTotal(response.total);
      const [periodList, approvalList] = await Promise.all([
        listStockLedgerPeriods(fetch, apiScope),
        listStockLedgerApprovals('pending', fetch, apiScope),
      ]);
      setPeriods(periodList);
      setApprovals(approvalList);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load stock ledger records';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [apiScope, movementTypeFilter, search]);

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
      toast.success(`Batch created. created=${result.createdCount}, rejected=${result.rejectedCount}`);
      setDialogOpen(false);
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
              <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setRefreshTick((value) => value + 1)}>
                <RefreshCw className="mr-1 h-4 w-4" />
                Refresh
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => { void runReconciliation(); }}>
                <ShieldCheck className="mr-1 h-4 w-4" />
                Reconcile
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => { void exportReport('stock-balance'); }}>
                <Download className="mr-1 h-4 w-4" />
                Export Balance
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => { void exportReport('valuation-summary'); }}>
                <Download className="mr-1 h-4 w-4" />
                Export Valuation
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => { void exportAudit(); }}>
                <Download className="mr-1 h-4 w-4" />
                Export Audit
              </Button>
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

        <Tabs value={opsTab} onValueChange={(value) => setOpsTab(value as 'periods' | 'approvals')} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="periods">Period Controls</TabsTrigger>
            <TabsTrigger value="approvals">Approval Queue</TabsTrigger>
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
