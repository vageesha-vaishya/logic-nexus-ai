/**
 * AMRO Compliance Dashboard Component
 * 
 * Features:
 * - AD/SB directive list with status tracking
 * - Compliance tracking per work package
 * - Certificate of Release to Service (CRS) generation
 * - Evidence attachment interface
 * - Audit trail viewer
 * - Expiry alerts for licenses and certificates
 * 
 * Design System:
 * - Uses AmroModuleSurface for container
 * - Uses AmroStandardToolbar for search/filter/actions
 * - Uses AmroKpiGrid for compliance metrics
 * - Uses AmroModuleGridDetailPanel for split-view
 */

import { useCallback, useMemo, useState } from 'react';
import { AlertTriangle, BadgeCheck, Calendar, CheckCircle2, FileText, Plus, RefreshCw, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AmroKpiGrid, AmroModuleSurface, AmroStandardToolbar } from '../parts/AmroPartsUiStandards';
import { AmroCrudDialogFooter, AmroCrudMessageBanner } from '../parts/AmroCrudPrimitives';
import { AmroModuleGridDetailPanel } from '../parts/AmroModuleGridDetailPanel';
import {
  useListComplianceRecords,
  useCreateComplianceRecord,
  useCreateCertificate,
  type ComplianceRecord,
  type ComplianceType,
  type ComplianceStatus,
} from './useComplianceState';

type Props = {
  workPackageId: string;
};

const COMPLIANCE_TYPE_CONFIG: Record<ComplianceType, { label: string; icon: any; color: string }> = {
  AD: { label: 'Airworthiness Directive', icon: Shield, color: 'text-red-600' },
  SB: { label: 'Service Bulletin', icon: FileText, color: 'text-blue-600' },
  inspection: { label: 'Inspection', icon: BadgeCheck, color: 'text-green-600' },
  certification: { label: 'Certification', icon: BadgeCheck, color: 'text-purple-600' },
  routine: { label: 'Routine', icon: CheckCircle2, color: 'text-slate-600' },
};

const STATUS_CONFIG: Record<ComplianceStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pending', variant: 'outline' },
  in_progress: { label: 'In Progress', variant: 'secondary' },
  completed: { label: 'Completed', variant: 'default' },
  deferred: { label: 'Deferred', variant: 'outline' },
  exempted: { label: 'Exempted', variant: 'secondary' },
};

const DEFAULT_RECORD_FORM = {
  compliance_type: 'AD' as ComplianceType,
  compliance_reference: '',
  compliance_method: '',
  compliance_status: 'pending' as ComplianceStatus,
  certified_by: '',
  license_number: '',
  license_expiry: '',
  inspection_result: '',
  findings: '',
};

const DEFAULT_CERT_FORM = {
  certifying_staff_id: '',
  staff_license_number: '',
  staff_license_type: 'B1',
  staff_license_expiry: '',
  work_description: '',
  regulations_complied: '',
  limitations: '',
  remarks: '',
};

export function AmroComplianceDashboard({ workPackageId }: Props): JSX.Element {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'records' | 'certificates'>('records');

  // Dialog state
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [recordFormLoading, setRecordFormLoading] = useState(false);
  const [recordForm, setRecordForm] = useState({ ...DEFAULT_RECORD_FORM });

  const [certDialogOpen, setCertDialogOpen] = useState(false);
  const [certFormLoading, setCertFormLoading] = useState(false);
  const [certForm, setCertForm] = useState({ ...DEFAULT_CERT_FORM });

  // Selected record for detail view
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  // Data fetching
  const { data, isLoading, error } = useListComplianceRecords({
    workPackageId,
    complianceType: typeFilter === 'all' ? undefined : typeFilter as ComplianceType,
    status: statusFilter === 'all' ? undefined : statusFilter as ComplianceStatus,
  });

  const createRecordMutation = useCreateComplianceRecord();
  const createCertMutation = useCreateCertificate();

  // Computed values
  const records = useMemo(() => {
    const allRecords = data?.records || [];
    if (!search) return allRecords;
    const searchLower = search.toLowerCase();
    return allRecords.filter(
      (r) =>
        r.compliance_reference.toLowerCase().includes(searchLower) ||
        r.compliance_method?.toLowerCase().includes(searchLower) ||
        r.directive?.directive_number?.toLowerCase().includes(searchLower),
    );
  }, [data?.records, search]);

  const selectedRecord = useMemo(
    () => records.find((r) => r.id === selectedRecordId) || null,
    [records, selectedRecordId],
  );

  const kpiData = useMemo(() => {
    const allRecords = data?.records || [];
    return {
      total: allRecords.length,
      completed: allRecords.filter((r) => r.compliance_status === 'completed').length,
      pending: allRecords.filter((r) => r.compliance_status === 'pending').length,
      inProgress: allRecords.filter((r) => r.compliance_status === 'in_progress').length,
    };
  }, [data?.records]);

  // Handlers
  const handleCreateRecord = useCallback(() => {
    setRecordForm({ ...DEFAULT_RECORD_FORM });
    setRecordDialogOpen(true);
  }, []);

  const handleCreateCertificate = useCallback(() => {
    setCertForm({ ...DEFAULT_CERT_FORM });
    setCertDialogOpen(true);
  }, []);

  const handleRecordFormSubmit = useCallback(async () => {
    if (!recordForm.compliance_reference) {
      toast.error('Compliance reference is required');
      return;
    }

    setRecordFormLoading(true);
    try {
      await createRecordMutation.mutateAsync({
        work_package_id: workPackageId,
        compliance_type: recordForm.compliance_type,
        compliance_reference: recordForm.compliance_reference,
        compliance_method: recordForm.compliance_method || undefined,
        compliance_status: recordForm.compliance_status,
        certified_by: recordForm.certified_by || undefined,
        license_number: recordForm.license_number || undefined,
        license_expiry: recordForm.license_expiry || undefined,
        inspection_result: recordForm.inspection_result || undefined,
        findings: recordForm.findings || undefined,
      });
      toast.success('Compliance record created successfully');
      setRecordDialogOpen(false);
      setRecordForm({ ...DEFAULT_RECORD_FORM });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create compliance record');
    } finally {
      setRecordFormLoading(false);
    }
  }, [workPackageId, recordForm, createRecordMutation]);

  const handleCertFormSubmit = useCallback(async () => {
    if (!certForm.certifying_staff_id || !certForm.staff_license_number || !certForm.work_description || !certForm.regulations_complied) {
      toast.error('All required fields must be filled');
      return;
    }

    setCertFormLoading(true);
    try {
      await createCertMutation.mutateAsync({
        work_package_id: workPackageId,
        certifying_staff_id: certForm.certifying_staff_id,
        staff_license_number: certForm.staff_license_number,
        staff_license_type: certForm.staff_license_type,
        staff_license_expiry: certForm.staff_license_expiry,
        work_description: certForm.work_description,
        regulations_complied: certForm.regulations_complied.split(',').map((r) => r.trim()),
        limitations: certForm.limitations || undefined,
        remarks: certForm.remarks || undefined,
      });
      toast.success('Certificate of Release to Service issued successfully');
      setCertDialogOpen(false);
      setCertForm({ ...DEFAULT_CERT_FORM });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create certificate');
    } finally {
      setCertFormLoading(false);
    }
  }, [workPackageId, certForm, createCertMutation]);

  const formatTimeAgo = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  }, []);

  if (error) {
    return (
      <AmroModuleSurface>
        <AmroCrudMessageBanner
          variant="error"
          title="Failed to load compliance records"
          message={error.message}
        />
      </AmroModuleSurface>
    );
  }

  return (
    <AmroModuleSurface>
      {/* KPI Grid */}
      <AmroKpiGrid
        kpiTiles={[
          {
            id: 'total',
            label: 'Total Compliance Records',
            value: kpiData.total,
            icon: 'shield',
            trend: 'neutral',
          },
          {
            id: 'completed',
            label: 'Completed',
            value: kpiData.completed,
            icon: 'check-circle',
            trend: 'positive',
          },
          {
            id: 'pending',
            label: 'Pending',
            value: kpiData.pending,
            icon: 'clock',
            trend: kpiData.pending > 0 ? 'negative' : 'positive',
          },
          {
            id: 'inProgress',
            label: 'In Progress',
            value: kpiData.inProgress,
            icon: 'loader',
            trend: 'neutral',
          },
        ]}
      />

      {/* Toolbar */}
      <AmroStandardToolbar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search compliance records...',
        }}
        filters={{
          type: {
            value: typeFilter,
            onChange: setTypeFilter,
            options: [
              { value: 'all', label: 'All Types' },
              ...Object.entries(COMPLIANCE_TYPE_CONFIG).map(([key, cfg]) => ({
                value: key,
                label: cfg.label,
              })),
            ],
          },
          status: {
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: 'all', label: 'All Statuses' },
              ...Object.entries(STATUS_CONFIG).map(([key, cfg]) => ({
                value: key,
                label: cfg.label,
              })),
            ],
          },
        }}
        actions={
          <div className="flex items-center gap-2">
            <Button onClick={handleCreateRecord} variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New Record
            </Button>
            <Button onClick={handleCreateCertificate} size="sm">
              <BadgeCheck className="mr-2 h-4 w-4" />
              Issue CRS
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-2 mt-6 mb-4">
        <Button
          variant={activeTab === 'records' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('records')}
        >
          <Shield className="mr-2 h-4 w-4" />
          Compliance Records
        </Button>
        <Button
          variant={activeTab === 'certificates' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('certificates')}
        >
          <BadgeCheck className="mr-2 h-4 w-4" />
          Certificates
        </Button>
      </div>

      {/* Main Content with Split View */}
      <AmroModuleGridDetailPanel
        listTitle="Compliance Records"
        listContent={
          <div className="space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Loading records...
              </div>
            ) : records.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Shield className="h-12 w-12 mb-3 text-muted-foreground/50" />
                <p className="text-sm">No compliance records found</p>
                <Button onClick={handleCreateRecord} variant="outline" size="sm" className="mt-2">
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Record
                </Button>
              </div>
            ) : (
              records.map((record) => {
                const typeCfg = COMPLIANCE_TYPE_CONFIG[record.compliance_type];
                const statusCfg = STATUS_CONFIG[record.compliance_status];
                const TypeIcon = typeCfg.icon;

                return (
                  <div
                    key={record.id}
                    className={`rounded-lg border p-4 transition-colors hover:bg-muted/50 cursor-pointer ${
                      selectedRecordId === record.id ? 'border-primary bg-muted/50' : ''
                    }`}
                    onClick={() => setSelectedRecordId(record.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <TypeIcon className={`h-4 w-4 ${typeCfg.color}`} />
                          <span className="font-medium">{record.compliance_reference}</span>
                          <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {record.compliance_method || record.findings || 'No details provided'}
                        </p>
                        {record.certificate_number && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Certificate: {record.certificate_number}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          Created {formatTimeAgo(record.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 ml-4">
                        {record.compliance_status === 'completed' && (
                          <BadgeCheck className="h-5 w-5 text-green-600" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        }
        detailTitle={selectedRecord ? 'Record Details' : 'Record Details'}
        detailContent={
          selectedRecord ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_CONFIG[selectedRecord.compliance_status].variant}>
                  {STATUS_CONFIG[selectedRecord.compliance_status].label}
                </Badge>
                {selectedRecord.compliance_type === 'AD' && (
                  <Badge variant="destructive">AD</Badge>
                )}
                {selectedRecord.compliance_type === 'SB' && (
                  <Badge variant="outline">SB</Badge>
                )}
              </div>
              <div>
                <Label className="text-muted-foreground">Compliance Reference</Label>
                <p className="text-sm mt-1 font-medium">{selectedRecord.compliance_reference}</p>
              </div>
              {selectedRecord.compliance_method && (
                <div>
                  <Label className="text-muted-foreground">Compliance Method</Label>
                  <p className="text-sm mt-1">{selectedRecord.compliance_method}</p>
                </div>
              )}
              {selectedRecord.findings && (
                <div>
                  <Label className="text-muted-foreground">Findings</Label>
                  <p className="text-sm mt-1">{selectedRecord.findings}</p>
                </div>
              )}
              {selectedRecord.inspection_result && (
                <div>
                  <Label className="text-muted-foreground">Inspection Result</Label>
                  <p className="text-sm mt-1">{selectedRecord.inspection_result}</p>
                </div>
              )}
              {selectedRecord.certificate_number && (
                <div>
                  <Label className="text-muted-foreground">Certificate Number</Label>
                  <p className="text-sm mt-1 font-mono">{selectedRecord.certificate_number}</p>
                </div>
              )}
              {selectedRecord.license_number && (
                <div>
                  <Label className="text-muted-foreground">License Number</Label>
                  <p className="text-sm mt-1">{selectedRecord.license_number}</p>
                </div>
              )}
              {selectedRecord.license_expiry && (
                <div>
                  <Label className="text-muted-foreground">License Expiry</Label>
                  <p className="text-sm mt-1 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {new Date(selectedRecord.license_expiry).toLocaleDateString()}
                  </p>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground">Created At</Label>
                <p className="text-sm mt-1">{new Date(selectedRecord.created_at).toLocaleString()}</p>
              </div>
              {selectedRecord.evidence_attachments && selectedRecord.evidence_attachments.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Evidence Attachments</Label>
                  <div className="mt-2 space-y-1">
                    {selectedRecord.evidence_attachments.map((attachment: any, idx: number) => (
                      <div key={idx} className="text-sm p-2 rounded bg-muted">
                        <p className="font-medium">{attachment.type}</p>
                        {attachment.description && (
                          <p className="text-xs text-muted-foreground">{attachment.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Select a record to view details
            </div>
          )
        }
      />

      {/* Create Compliance Record Dialog */}
      <Dialog open={recordDialogOpen} onOpenChange={setRecordDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Create Compliance Record
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="compliance_type">Compliance Type *</Label>
                <Select
                  value={recordForm.compliance_type}
                  onValueChange={(val) => setRecordForm({ ...recordForm, compliance_type: val as ComplianceType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(COMPLIANCE_TYPE_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>
                        {cfg.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="compliance_status">Status</Label>
                <Select
                  value={recordForm.compliance_status}
                  onValueChange={(val) => setRecordForm({ ...recordForm, compliance_status: val as ComplianceStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>
                        {cfg.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="compliance_reference">Compliance Reference *</Label>
              <Input
                id="compliance_reference"
                value={recordForm.compliance_reference}
                onChange={(e) => setRecordForm({ ...recordForm, compliance_reference: e.target.value })}
                placeholder="e.g., AD 2024-15-07"
                required
              />
            </div>
            <div>
              <Label htmlFor="compliance_method">Compliance Method</Label>
              <Textarea
                id="compliance_method"
                value={recordForm.compliance_method}
                onChange={(e) => setRecordForm({ ...recordForm, compliance_method: e.target.value })}
                placeholder="How compliance was achieved..."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="certified_by">Certified By (User ID)</Label>
                <Input
                  id="certified_by"
                  value={recordForm.certified_by}
                  onChange={(e) => setRecordForm({ ...recordForm, certified_by: e.target.value })}
                  placeholder="User ID"
                />
              </div>
              <div>
                <Label htmlFor="license_number">License Number</Label>
                <Input
                  id="license_number"
                  value={recordForm.license_number}
                  onChange={(e) => setRecordForm({ ...recordForm, license_number: e.target.value })}
                  placeholder="e.g., B1-12345"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="license_expiry">License Expiry</Label>
              <Input
                id="license_expiry"
                type="date"
                value={recordForm.license_expiry}
                onChange={(e) => setRecordForm({ ...recordForm, license_expiry: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="inspection_result">Inspection Result</Label>
                <Textarea
                  id="inspection_result"
                  value={recordForm.inspection_result}
                  onChange={(e) => setRecordForm({ ...recordForm, inspection_result: e.target.value })}
                  placeholder="Results..."
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="findings">Findings</Label>
                <Textarea
                  id="findings"
                  value={recordForm.findings}
                  onChange={(e) => setRecordForm({ ...recordForm, findings: e.target.value })}
                  placeholder="Findings..."
                  rows={2}
                />
              </div>
            </div>
          </div>
          <AmroCrudDialogFooter
            loading={recordFormLoading}
            onCancel={() => setRecordDialogOpen(false)}
            submitLabel="Create Record"
          />
        </DialogContent>
      </Dialog>

      {/* Issue CRS Dialog */}
      <Dialog open={certDialogOpen} onOpenChange={setCertDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BadgeCheck className="h-5 w-5 text-green-600" />
              Issue Certificate of Release to Service
            </DialogTitle>
          </DialogHeader>
          <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 p-3 mb-4">
            <p className="text-sm text-green-800 dark:text-green-200">
              <strong>Important:</strong> This certificate will mark the work package as completed and release the aircraft back to service.
            </p>
          </div>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="certifying_staff_id">Certifying Staff ID *</Label>
                <Input
                  id="certifying_staff_id"
                  value={certForm.certifying_staff_id}
                  onChange={(e) => setCertForm({ ...certForm, certifying_staff_id: e.target.value })}
                  placeholder="User ID"
                  required
                />
              </div>
              <div>
                <Label htmlFor="staff_license_type">License Type *</Label>
                <Select
                  value={certForm.staff_license_type}
                  onValueChange={(val) => setCertForm({ ...certForm, staff_license_type: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="B1">B1 - Mechanical</SelectItem>
                    <SelectItem value="B2">B2 - Avionics</SelectItem>
                    <SelectItem value="C">C - Base Maintenance</SelectItem>
                    <SelectItem value="A">A - Line Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="staff_license_number">License Number *</Label>
                <Input
                  id="staff_license_number"
                  value={certForm.staff_license_number}
                  onChange={(e) => setCertForm({ ...certForm, staff_license_number: e.target.value })}
                  placeholder="e.g., B1-12345"
                  required
                />
              </div>
              <div>
                <Label htmlFor="staff_license_expiry">License Expiry *</Label>
                <Input
                  id="staff_license_expiry"
                  type="date"
                  value={certForm.staff_license_expiry}
                  onChange={(e) => setCertForm({ ...certForm, staff_license_expiry: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="work_description">Work Description *</Label>
              <Textarea
                id="work_description"
                value={certForm.work_description}
                onChange={(e) => setCertForm({ ...certForm, work_description: e.target.value })}
                placeholder="Description of work completed..."
                required
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="regulations_complied">Regulations Complied With * (comma-separated)</Label>
              <Input
                id="regulations_complied"
                value={certForm.regulations_complied}
                onChange={(e) => setCertForm({ ...certForm, regulations_complied: e.target.value })}
                placeholder="e.g., EASA Part-145, FAA 14 CFR Part 145"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="limitations">Limitations</Label>
                <Textarea
                  id="limitations"
                  value={certForm.limitations}
                  onChange={(e) => setCertForm({ ...certForm, limitations: e.target.value })}
                  placeholder="Any limitations..."
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="remarks">Remarks</Label>
                <Textarea
                  id="remarks"
                  value={certForm.remarks}
                  onChange={(e) => setCertForm({ ...certForm, remarks: e.target.value })}
                  placeholder="Additional remarks..."
                  rows={2}
                />
              </div>
            </div>
          </div>
          <AmroCrudDialogFooter
            loading={certFormLoading}
            onCancel={() => setCertDialogOpen(false)}
            submitLabel="Issue Certificate"
          />
        </DialogContent>
      </Dialog>
    </AmroModuleSurface>
  );
}
