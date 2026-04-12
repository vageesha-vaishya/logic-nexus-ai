/**
 * Template Clone Dialog
 * 
 * Allows users to duplicate an existing template with a new code and name.
 * All tasks, materials, tooling, and compliance requirements are copied.
 */

import { useState } from 'react';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { WorkPackageTemplate, AircraftModelOption } from './AmroWorkPackageTemplatesPage';
import { cloneTemplate } from './templateApi';
import { useAuth } from '@/hooks/useAuth';

interface TemplateCloneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: WorkPackageTemplate;
  onSuccess: () => void;
  aircraftModels: AircraftModelOption[];
}

export function TemplateCloneDialog({
  open,
  onOpenChange,
  template,
  onSuccess,
}: TemplateCloneDialogProps) {
  const { session } = useAuth();
  const accessToken = session?.access_token || '';

  const [newCode, setNewCode] = useState(`${template.template_code}-COPY`);
  const [newName, setNewName] = useState(`${template.template_name} (Copy)`);
  const [loading, setLoading] = useState(false);

  const handleClone = async () => {
    if (!newCode.trim() || !newName.trim()) {
      toast.error('Template code and name are required');
      return;
    }

    setLoading(true);
    try {
      await cloneTemplate(accessToken, template.id, newCode.trim(), newName.trim());
      toast.success('Template cloned successfully');
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to clone template');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Clone Template
          </DialogTitle>
          <DialogDescription>
            Create a copy of "{template.template_name}" with all its tasks, materials, and requirements.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Original Template</Label>
            <div className="mt-1 p-3 bg-muted rounded-md">
              <p className="text-sm font-medium">{template.template_name}</p>
              <p className="text-xs text-muted-foreground font-mono">{template.template_code}</p>
            </div>
          </div>

          <div>
            <Label>New Template Code *</Label>
            <Input
              value={newCode}
              onChange={e => setNewCode(e.target.value)}
              placeholder="e.g., ACHK-737-002"
            />
          </div>

          <div>
            <Label>New Template Name *</Label>
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g., Boeing 737 A-Check v2"
            />
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">
              The following will be copied to the new template:
            </p>
            <ul className="text-sm text-blue-700 mt-2 ml-4 list-disc space-y-1">
              <li>{template.tasks_count || 0} task(s)</li>
              <li>Maintenance type: {template.maintenance_type}</li>
              <li>Aircraft model: {template.aircraft_model || 'All Models'}</li>
              <li>Materials, tooling, and compliance requirements</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleClone} disabled={loading}>
            {loading ? 'Cloning...' : 'Clone Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
