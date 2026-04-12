/**
 * AMRO Template Version Manager Component
 * 
 * Features:
 * - List all versions of a template with status badges
 * - Create new version (draft)
 * - Edit draft versions
 * - Submit for review workflow
 * - Approve/reject (admin only)
 * - Version comparison view
 * - Effectivity date visualization
 * 
 * Design System:
 * - Uses AmroModuleSurface for container
 * - Uses AmroStandardToolbar for search/filter/actions
 * - Uses AmroKpiGrid for metrics
 * - Uses AmroModuleGridDetailPanel for split-view
 * - Uses AmroCrudDialogFooter for form actions
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, Edit, Eye, Plus, RefreshCw, Send, Trash2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AmroKpiGrid, AmroModuleSurface, AmroStandardToolbar } from '../parts/AmroPartsUiStandards';
import { AmroCrudDialogFooter, AmroCrudMessageBanner } from '../parts/AmroCrudPrimitives';
import {
  useListTemplateVersions,
  useCreateTemplateVersion,
  useUpdateTemplateVersion,
  useDeleteTemplateVersion,
  useSubmitTemplateVersion,
  useReviewTemplateVersion,
  type TemplateVersion,
  type TemplateVersionStatus,
} from './useTemplateVersionState';

type Props = {
  templateId: string;
  templateName?: string;
};

const STATUS_CONFIG: Record<TemplateVersionStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Draft', variant: 'outline' },
  pending_review: { label: 'Pending Review', variant: 'secondary' },
  approved: { label: 'Approved', variant: 'default' },
  active: { label: 'Active', variant: 'default' },
  deprecated: { label: 'Deprecated', variant: 'destructive' },
  archived: { label: 'Archived', variant: 'outline' },
};

const DEFAULT_FORM = {
  version_label: '',
  change_description: '',
  change_reason: '',
  effective_from: '',
  effective_until: '',
  scope_json: '{}',
  tasks_json: '[]',
};

function cloneFormValue(version?: TemplateVersion | null) {
  if (!version) return { ...DEFAULT_FORM };
  return {
    version_label: version.version_label || '',
    change_description: version.change_description || '',
    change_reason: version.change_reason || '',
    effective_from: version.effective_from || '',
    effective_until: version.effective_until || '',
    scope_json: JSON.stringify(version.scope_json, null, 2),
    tasks_json: JSON.stringify(version.tasks_json, null, 2),
  };
}

export function AmroTemplateVersionManager({ templateId, templateName }: Props): JSX.Element {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [refreshTick, setRefreshTick] = useState(0);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formValue, setFormValue] = useState(cloneFormValue());

  // Delete confirmation
  const [deleteCandidate, setDeleteCandidate] = useState<TemplateVersion | null>(null);

  // Review dialog
  const [reviewCandidate, setReviewCandidate] = useState<TemplateVersion | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [rejectionReason, setRejectionReason] = useState('');

  // Selected version for detail view
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  // Data fetching
  const { data, isLoading, error } = useListTemplateVersions({
    templateId,
    page: 1,
    pageSize: 50,
    status: statusFilter === 'all' ? undefined : statusFilter as TemplateVersionStatus,
    enabled: !!templateId,
  });

  const createMutation = useCreateTemplateVersion();
  const updateMutation = useUpdateTemplateVersion();
  const deleteMutation = useDeleteTemplateVersion();
  const submitMutation = useSubmitTemplateVersion();
  const reviewMutation = useReviewTemplateVersion();

  // Computed values
  const versions = useMemo(() => {
    const allVersions = data?.records || [];
    if (!search) return allVersions;
    const searchLower = search.toLowerCase();
    return allVersions.filter(
      (v) =>
        v.version_label?.toLowerCase().includes(searchLower) ||
        v.change_description.toLowerCase().includes(searchLower) ||
        v.version_number.toString().includes(searchLower),
    );
  }, [data?.records, search]);

  const selectedVersion = useMemo(
    () => versions.find((v) => v.id === selectedVersionId) || null,
    [versions, selectedVersionId],
  );

  const kpiData = useMemo(() => {
    const allVersions = data?.records || [];
    return {
      total: allVersions.length,
      active: allVersions.filter((v) => v.status === 'active').length,
      draft: allVersions.filter((v) => v.status === 'draft').length,
      pending: allVersions.filter((v) => v.status === 'pending_review').length,
    };
  }, [data?.records]);

  // Handlers
  const handleRefresh = useCallback(() => {
    setRefreshTick((t) => t + 1);
    toast.success('Template versions refreshed');
  }, []);

  const handleCreate = useCallback(() => {
    setEditingId(null);
    setFormValue(cloneFormValue());
    setDialogOpen(true);
  }, []);

  const handleEdit = useCallback((version: TemplateVersion) => {
    if (version.status !== 'draft') {
      toast.error('Only draft versions can be edited');
      return;
    }
    setEditingId(version.id);
    setFormValue(cloneFormValue(version));
    setDialogOpen(true);
  }, []);

  const handleDelete = useCallback((version: TemplateVersion) => {
    if (version.status !== 'draft') {
      toast.error('Only draft versions can be deleted');
      return;
    }
    setDeleteCandidate(version);
  }, []);

  const handleSubmitForReview = useCallback((version: TemplateVersion) => {
    if (version.status !== 'draft') {
      toast.error('Only draft versions can be submitted');
      return;
    }
    setSubmitCandidate(version);
  }, []);

  const [submitCandidate, setSubmitCandidate] = useState<TemplateVersion | null>(null);

  const handleReview = useCallback((version: TemplateVersion, action: 'approve' | 'reject') => {
    if (version.status !== 'pending_review') {
      toast.error('Only pending_review versions can be reviewed');
      return;
    }
    setReviewCandidate(version);
    setReviewAction(action);
    setRejectionReason('');
  }, []);

  // Form submission
  const handleFormSubmit = useCallback(async () => {
    setDialogLoading(true);
    try {
      const inputData = {
        template_id: templateId,
        change_description: formValue.change_description,
        change_reason: formValue.change_reason || undefined,
        version_label: formValue.version_label || undefined,
        effective_from: formValue.effective_from || undefined,
        effective_until: formValue.effective_until || undefined,
        scope_json: JSON.parse(formValue.scope_json),
        tasks_json: JSON.parse(formValue.tasks_json),
      };

      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, ...inputData });
        toast.success('Template version updated successfully');
      } else {
        await createMutation.mutateAsync(inputData);
        toast.success('Template version created successfully');
      }
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save template version');
    } finally {
      setDialogLoading(false);
    }
  }, [templateId, formValue, editingId, createMutation, updateMutation]);

  // Delete confirmation
  const handleConfirmDelete = useCallback(async () => {
    if (!deleteCandidate) return;
    try {
      await deleteMutation.mutateAsync(deleteCandidate.id);
      toast.success('Template version deleted successfully');
      setDeleteCandidate(null);
      if (selectedVersionId === deleteCandidate.id) {
        setSelectedVersionId(null);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete template version');
    }
  }, [deleteCandidate, deleteMutation, selectedVersionId]);

  // Submit for review
  const handleConfirmSubmit = useCallback(async () => {
    if (!submitCandidate) return;
    try {
      await submitMutation.mutateAsync(submitCandidate.id);
      toast.success('Template version submitted for review');
      setSubmitCandidate(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit for review');
    }
  }, [submitCandidate, submitMutation]);

  // Review (approve/reject)
  const handleConfirmReview = useCallback(async () => {
    if (!reviewCandidate) return;
    try {
      await reviewMutation.mutateAsync({
        id: reviewCandidate.id,
        action: reviewAction,
        rejection_reason: reviewAction === 'reject' ? rejectionReason || undefined : undefined,
      });
      toast.success(`Template version ${reviewAction === 'approve' ? 'approved' : 'rejected'} successfully`);
      setReviewCandidate(null);
      setRejectionReason('');
    } catch (err: any) {
      toast.error(err.message || `Failed to ${reviewAction} template version`);
    }
  }, [reviewCandidate, reviewAction, rejectionReason, reviewMutation]);

  if (error) {
    return (
      <AmroModuleSurface>
        <AmroCrudMessageBanner
          variant="error"
          title="Failed to load template versions"
          message={error.message}
        />
        <Button onClick={handleRefresh} variant="outline" className="mt-4">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </AmroModuleSurface>
    );
  }

  return (
    <AmroModuleSurface>
      {/* KPI Grid */}
      <AmroKpiGrid
        kpiTiles={[
          { id: 'total', label: 'Total Versions', value: kpiData.total, icon: 'versions', trend: 'neutral' },
          { id: 'active', label: 'Active', value: kpiData.active, icon: 'check', trend: 'positive' },
          { id: 'draft', label: 'Draft', value: kpiData.draft, icon: 'edit', trend: 'neutral' },
          { id: 'pending', label: 'Pending Review', value: kpiData.pending, icon: 'clock', trend: 'neutral' },
        ]}
      />

      {/* Toolbar */}
      <AmroStandardToolbar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search versions...',
        }}
        filters={{
          status: {
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: 'all', label: 'All Statuses' },
              { value: 'draft', label: 'Draft' },
              { value: 'pending_review', label: 'Pending Review' },
              { value: 'approved', label: 'Approved' },
              { value: 'active', label: 'Active' },
              { value: 'deprecated', label: 'Deprecated' },
              { value: 'archived', label: 'Archived' },
            ],
          },
        }}
        actions={
          <div className="flex items-center gap-2">
            <Button onClick={handleRefresh} variant="outline" size="sm" disabled={isLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={handleCreate} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New Version
            </Button>
          </div>
        }
      />

      {/* Main Content with Split View */}
      <AmroModuleGridDetailPanel
        listTitle={`Template Versions${templateName ? ` - ${templateName}` : ''}`}
        listContent={
          <div className="space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Loading versions...
              </div>
            ) : versions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <p className="text-sm">No template versions found</p>
                <Button onClick={handleCreate} variant="outline" size="sm" className="mt-2">
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Version
                </Button>
              </div>
            ) : (
              versions.map((version) => {
                const statusCfg = STATUS_CONFIG[version.status];
                return (
                  <div
                    key={version.id}
                    className={`rounded-lg border p-4 transition-colors hover:bg-muted/50 cursor-pointer ${
                      selectedVersionId === version.id ? 'border-primary bg-muted/50' : ''
                    }`}
                    onClick={() => setSelectedVersionId(version.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">v{version.version_number}</span>
                          {version.version_label && (
                            <span className="text-sm text-muted-foreground">- {version.version_label}</span>
                          )}
                          <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {version.change_description}
                        </p>
                        {version.effective_from && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Effective: {new Date(version.effective_from).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-4">
                        {version.status === 'draft' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(version);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSubmitForReview(version);
                              }}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(version);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                        {version.status === 'pending_review' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReview(version, 'approve');
                              }}
                            >
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReview(version, 'reject');
                              }}
                            >
                              <XCircle className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        }
        detailTitle={selectedVersion ? `Version ${selectedVersion.version_number}` : 'Version Details'}
        detailContent={
          selectedVersion ? (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <Badge variant={STATUS_CONFIG[selectedVersion.status].variant}>
                  {STATUS_CONFIG[selectedVersion.status].label}
                </Badge>
              </div>
              <div>
                <Label className="text-muted-foreground">Change Description</Label>
                <p className="text-sm mt-1">{selectedVersion.change_description}</p>
              </div>
              {selectedVersion.change_reason && (
                <div>
                  <Label className="text-muted-foreground">Change Reason</Label>
                  <p className="text-sm mt-1">{selectedVersion.change_reason}</p>
                </div>
              )}
              {selectedVersion.effective_from && (
                <div>
                  <Label className="text-muted-foreground">Effective From</Label>
                  <p className="text-sm mt-1">
                    {new Date(selectedVersion.effective_from).toLocaleDateString()}
                  </p>
                </div>
              )}
              {selectedVersion.effective_until && (
                <div>
                  <Label className="text-muted-foreground">Effective Until</Label>
                  <p className="text-sm mt-1">
                    {new Date(selectedVersion.effective_until).toLocaleDateString()}
                  </p>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground">Created At</Label>
                <p className="text-sm mt-1">
                  {new Date(selectedVersion.created_at).toLocaleString()}
                </p>
              </div>
              {selectedVersion.submitted_at && (
                <div>
                  <Label className="text-muted-foreground">Submitted At</Label>
                  <p className="text-sm mt-1">
                    {new Date(selectedVersion.submitted_at).toLocaleString()}
                  </p>
                </div>
              )}
              {selectedVersion.approved_at && (
                <div>
                  <Label className="text-muted-foreground">Approved At</Label>
                  <p className="text-sm mt-1">
                    {new Date(selectedVersion.approved_at).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Select a version to view details
            </div>
          )
        }
      />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Template Version' : 'Create New Template Version'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="version_label">Version Label (optional)</Label>
                <Input
                  id="version_label"
                  value={formValue.version_label}
                  onChange={(e) => setFormValue({ ...formValue, version_label: e.target.value })}
                  placeholder="e.g., Initial Release"
                />
              </div>
              <div>
                <Label htmlFor="change_reason">Change Reason (optional)</Label>
                <Input
                  id="change_reason"
                  value={formValue.change_reason}
                  onChange={(e) => setFormValue({ ...formValue, change_reason: e.target.value })}
                  placeholder="e.g., AD compliance update"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="change_description">Change Description *</Label>
              <Textarea
                id="change_description"
                value={formValue.change_description}
                onChange={(e) => setFormValue({ ...formValue, change_description: e.target.value })}
                placeholder="Describe what changed in this version..."
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="effective_from">Effective From</Label>
                <Input
                  id="effective_from"
                  type="date"
                  value={formValue.effective_from}
                  onChange={(e) => setFormValue({ ...formValue, effective_from: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="effective_until">Effective Until</Label>
                <Input
                  id="effective_until"
                  type="date"
                  value={formValue.effective_until}
                  onChange={(e) => setFormValue({ ...formValue, effective_until: e.target.value })}
                />
              </div>
            </div>
          </div>
          <AmroCrudDialogFooter
            loading={dialogLoading}
            onCancel={() => setDialogOpen(false)}
            submitLabel={editingId ? 'Update' : 'Create'}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteCandidate} onOpenChange={() => setDeleteCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template Version</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete version {deleteCandidate?.version_number}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Submit for Review Confirmation */}
      <AlertDialog open={!!submitCandidate} onOpenChange={() => setSubmitCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit for Review</AlertDialogTitle>
            <AlertDialogDescription>
              Submit version {submitCandidate?.version_number} for review? This will lock the version and prevent further edits.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSubmit}>Submit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Review Dialog */}
      <Dialog open={!!reviewCandidate} onOpenChange={() => setReviewCandidate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approve' ? 'Approve' : 'Reject'} Version {reviewCandidate?.version_number}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {reviewAction === 'reject' && (
              <div>
                <Label htmlFor="rejection_reason">Rejection Reason *</Label>
                <Textarea
                  id="rejection_reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Provide reason for rejection..."
                  required
                />
              </div>
            )}
          </div>
          <AmroCrudDialogFooter
            loading={reviewMutation.isPending}
            onCancel={() => setReviewCandidate(null)}
            submitLabel={reviewAction === 'approve' ? 'Approve' : 'Reject'}
            submitVariant={reviewAction === 'approve' ? 'default' : 'destructive'}
          />
        </DialogContent>
      </Dialog>
    </AmroModuleSurface>
  );
}
