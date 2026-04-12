/**
 * Template Version Manager Dialog
 * 
 * Manages template versions with approval workflow:
 * - List all versions
 * - Create new version (with change description)
 * - Submit for review
 * - Approve/Reject versions
 * - View version details
 */

import { useCallback, useEffect, useState } from 'react';
import { Plus, Send, CheckCircle, XCircle, Eye, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import type { WorkPackageTemplate } from './AmroWorkPackageTemplatesPage';
import { 
  fetchTemplateVersions, 
  createTemplateVersion, 
  submitTemplateVersion, 
  reviewTemplateVersion,
  deleteTemplateVersion,
  type TemplateVersion 
} from './templateApi';
import { useAuth } from '@/hooks/useAuth';

interface TemplateVersionManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: WorkPackageTemplate;
  onSuccess: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  pending_review: { label: 'Pending Review', variant: 'outline' },
  approved: { label: 'Approved', variant: 'default' },
  active: { label: 'Active', variant: 'default' },
  deprecated: { label: 'Deprecated', variant: 'destructive' },
  archived: { label: 'Archived', variant: 'secondary' },
};

export function TemplateVersionManager({
  open,
  onOpenChange,
  template,
  onSuccess,
}: TemplateVersionManagerProps) {
  const { session } = useAuth();
  const accessToken = session?.access_token || '';

  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [reviewDialog, setReviewDialog] = useState<{ open: boolean; version: TemplateVersion | null; action: 'approve' | 'reject' }>({ open: false, version: null, action: 'approve' });
  const [rejectionReason, setRejectionReason] = useState('');
  const [setActive, setSetActive] = useState(false);

  // Create form
  const [changeDescription, setChangeDescription] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [versionLabel, setVersionLabel] = useState('');
  const [includeTasks, setIncludeTasks] = useState(true);
  const [includeMaterials, setIncludeMaterials] = useState(true);
  const [includeTooling, setIncludeTooling] = useState(true);
  const [includeCompliance, setIncludeCompliance] = useState(true);

  // ── Load Versions ──────────────────────────────────────────────────────────

  const loadVersions = useCallback(async () => {
    if (!accessToken || !open) return;
    setLoading(true);
    try {
      const result = await fetchTemplateVersions(accessToken, template.id);
      setVersions(result);
    } catch {
      setVersions([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, open, template.id]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  // ── Create Version ─────────────────────────────────────────────────────────

  const handleCreateVersion = async () => {
    if (!changeDescription.trim()) {
      toast.error('Change description is required');
      return;
    }

    setCreateLoading(true);
    try {
      const payload: any = {
        change_description: changeDescription.trim(),
        change_reason: changeReason.trim() || undefined,
        version_label: versionLabel.trim() || undefined,
      };

      if (includeTasks) payload.tasks_json = template.tasks_json || [];
      if (includeMaterials) payload.materials_json = template.materials_json || [];
      if (includeTooling) payload.tooling_json = template.tooling_json || [];
      if (includeCompliance) payload.compliance_requirements_json = template.compliance_requirements_json || [];

      await createTemplateVersion(accessToken, template.id, payload);
      toast.success('New version created');
      setShowCreateForm(false);
      setChangeDescription('');
      setChangeReason('');
      setVersionLabel('');
      loadVersions();
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create version');
    } finally {
      setCreateLoading(false);
    }
  };

  // ── Submit for Review ──────────────────────────────────────────────────────

  const handleSubmit = async (version: TemplateVersion) => {
    try {
      await submitTemplateVersion(accessToken, version.id);
      toast.success('Version submitted for review');
      loadVersions();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit');
    }
  };

  // ── Review (Approve/Reject) ────────────────────────────────────────────────

  const handleReview = async () => {
    if (!reviewDialog.version) return;

    if (reviewDialog.action === 'reject' && !rejectionReason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }

    try {
      await reviewTemplateVersion(
        accessToken,
        reviewDialog.version.id,
        reviewDialog.action,
        reviewDialog.action === 'reject' ? rejectionReason : undefined,
        setActive
      );
      toast.success(`Version ${reviewDialog.action === 'approve' ? 'approved' : 'rejected'}`);
      setReviewDialog({ open: false, version: null, action: 'approve' });
      setRejectionReason('');
      loadVersions();
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to review');
    }
  };

  // ── Delete Version ─────────────────────────────────────────────────────────

  const handleDelete = async (version: TemplateVersion) => {
    if (version.status !== 'draft') {
      toast.error('Only draft versions can be deleted');
      return;
    }
    try {
      await deleteTemplateVersion(accessToken, version.id);
      toast.success('Version deleted');
      loadVersions();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Versions</DialogTitle>
            <DialogDescription>
              {template.template_name} — Version History
            </DialogDescription>
          </DialogHeader>

          {/* Create New Version */}
          {!showCreateForm ? (
            <Button variant="outline" size="sm" onClick={() => setShowCreateForm(true)} className="mb-4">
              <Plus className="h-4 w-4 mr-1" />
              New Version
            </Button>
          ) : (
            <div className="space-y-4 mb-4 p-4 border rounded-md">
              <h4 className="font-medium">Create New Version</h4>
              <div>
                <Label>Change Description *</Label>
                <Textarea
                  value={changeDescription}
                  onChange={e => setChangeDescription(e.target.value)}
                  placeholder="Describe what changed in this version..."
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Change Reason</Label>
                  <Input
                    value={changeReason}
                    onChange={e => setChangeReason(e.target.value)}
                    placeholder="e.g., Regulatory update, process improvement..."
                  />
                </div>
                <div>
                  <Label>Version Label</Label>
                  <Input
                    value={versionLabel}
                    onChange={e => setVersionLabel(e.target.value)}
                    placeholder="e.g., Initial Release, Q2 Update..."
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm">Include in this version:</Label>
                <div className="flex gap-4 mt-2">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={includeTasks} onCheckedChange={v => setIncludeTasks(!!v)} />
                    <span className="text-sm">Tasks ({template.tasks_count || 0})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={includeMaterials} onCheckedChange={v => setIncludeMaterials(!!v)} />
                    <span className="text-sm">Materials</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={includeTooling} onCheckedChange={v => setIncludeTooling(!!v)} />
                    <span className="text-sm">Tooling</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={includeCompliance} onCheckedChange={v => setIncludeCompliance(!!v)} />
                    <span className="text-sm">Compliance</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreateVersion} disabled={createLoading}>
                  {createLoading ? 'Creating...' : 'Create Version'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Versions Table */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading versions...</div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No versions yet. Create the first version to begin.
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Change Description</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {versions.map((v) => {
                    const cfg = STATUS_CONFIG[v.status] || { label: v.status, variant: 'outline' as const };
                    return (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono font-bold">
                          {v.version_label || `v${v.version_number}`}
                        </TableCell>
                        <TableCell>
                          <Badge variant={cfg.variant}>{cfg.label}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate">
                          {v.change_description}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(v.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {v.status === 'draft' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSubmit(v)}
                                  title="Submit for Review"
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(v)}
                                  title="Delete Draft"
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {v.status === 'pending_review' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setReviewDialog({ open: true, version: v, action: 'approve' })}
                                  title="Approve"
                                  className="text-green-600"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setReviewDialog({ open: true, version: v, action: 'reject' })}
                                  title="Reject"
                                  className="text-destructive"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={reviewDialog.open} onOpenChange={(open) => { if (!open) setReviewDialog({ open: false, version: null, action: 'approve' }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewDialog.action === 'approve' ? 'Approve Version' : 'Reject Version'}
            </DialogTitle>
            <DialogDescription>
              {reviewDialog.version?.version_label || `v${reviewDialog.version?.version_number}`}
            </DialogDescription>
          </DialogHeader>

          {reviewDialog.action === 'reject' && (
            <div>
              <Label>Rejection Reason *</Label>
              <Textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="Explain why this version is being rejected..."
                rows={3}
              />
            </div>
          )}

          {reviewDialog.action === 'approve' && (
            <div className="flex items-center gap-2">
              <Checkbox checked={setActive} onCheckedChange={v => setSetActive(!!v)} />
              <Label>Set as active version</Label>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setReviewDialog({ open: false, version: null, action: 'approve' })}>
              Cancel
            </Button>
            <Button
              variant={reviewDialog.action === 'approve' ? 'default' : 'destructive'}
              onClick={handleReview}
            >
              {reviewDialog.action === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
