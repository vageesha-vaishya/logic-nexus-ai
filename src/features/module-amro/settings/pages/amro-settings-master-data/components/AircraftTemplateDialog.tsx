import type { Dispatch, SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type AircraftTemplateFormValues = {
  template_name: string;
  aircraft_type: string;
  manufacturer: string;
  manufacturer_id: string;
  aircraft_model: string;
  maintenance_program: string;
  revision_number: string;
  amendment_number: string;
};

type AircraftTemplateDialogProps = {
  open: boolean;
  mode: 'create' | 'update';
  submitting: boolean;
  formValues: AircraftTemplateFormValues;
  formErrors: Record<string, string>;
  setFormValues: Dispatch<SetStateAction<AircraftTemplateFormValues>>;
  setFormErrors: Dispatch<SetStateAction<Record<string, string>>>;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  setOpen: (open: boolean) => void;
};

export function AircraftTemplateDialog({
  open,
  mode,
  submitting,
  formValues,
  formErrors,
  setFormValues,
  setFormErrors,
  onClose,
  onSubmit,
  setOpen,
}: AircraftTemplateDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
          return;
        }
        setOpen(true);
      }}
    >
      <DialogContent className="mdm-template-dialog mdm-template-dialog-large">
        <DialogHeader className="border-b border-[hsl(var(--mdm-template-border))] px-6 py-4">
          <DialogTitle className="text-[15px] font-semibold text-[hsl(var(--mdm-template-heading))]">
            {mode === 'create' ? 'Create Aircraft Template' : 'Update Aircraft Template'}
          </DialogTitle>
          <DialogDescription className="text-[12px] text-[hsl(var(--mdm-template-muted))]">
            Maintain reusable aircraft template metadata for creation workflows.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-6 pb-6 pt-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="aircraft-template-name" className="mdm-template-label">Template Name</Label>
              <Input
                id="aircraft-template-name"
                value={formValues.template_name}
                onChange={(event) => {
                  const value = event.target.value;
                  setFormValues((previous) => ({ ...previous, template_name: value }));
                  if (formErrors.template_name) {
                    setFormErrors((previous) => ({ ...previous, template_name: '' }));
                  }
                }}
                className={cn('mdm-template-input', formErrors.template_name && 'border-destructive')}
                aria-invalid={Boolean(formErrors.template_name)}
              />
              {formErrors.template_name ? <p className="mdm-template-danger">{formErrors.template_name}</p> : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="aircraft-template-type" className="mdm-template-label">Aircraft Type</Label>
              <Input
                id="aircraft-template-type"
                value={formValues.aircraft_type}
                onChange={(event) => {
                  const value = event.target.value;
                  setFormValues((previous) => ({ ...previous, aircraft_type: value }));
                  if (formErrors.aircraft_type) {
                    setFormErrors((previous) => ({ ...previous, aircraft_type: '' }));
                  }
                }}
                className={cn('mdm-template-input', formErrors.aircraft_type && 'border-destructive')}
                aria-invalid={Boolean(formErrors.aircraft_type)}
              />
              {formErrors.aircraft_type ? <p className="mdm-template-danger">{formErrors.aircraft_type}</p> : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="aircraft-template-manufacturer" className="mdm-template-label">Manufacturer</Label>
              <Input
                id="aircraft-template-manufacturer"
                value={formValues.manufacturer}
                onChange={(event) => setFormValues((previous) => ({ ...previous, manufacturer: event.target.value }))}
                className="mdm-template-input"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="aircraft-template-manufacturer-id" className="mdm-template-label">Manufacturer ID</Label>
              <Input
                id="aircraft-template-manufacturer-id"
                value={formValues.manufacturer_id}
                onChange={(event) => setFormValues((previous) => ({ ...previous, manufacturer_id: event.target.value }))}
                className="mdm-template-input"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="aircraft-template-model" className="mdm-template-label">Aircraft Model</Label>
              <Input
                id="aircraft-template-model"
                value={formValues.aircraft_model}
                onChange={(event) => setFormValues((previous) => ({ ...previous, aircraft_model: event.target.value }))}
                className="mdm-template-input"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="aircraft-template-program" className="mdm-template-label">Maintenance Program</Label>
              <Input
                id="aircraft-template-program"
                value={formValues.maintenance_program}
                onChange={(event) => setFormValues((previous) => ({ ...previous, maintenance_program: event.target.value }))}
                className="mdm-template-input"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="aircraft-template-revision" className="mdm-template-label">Revision Number</Label>
              <Input
                id="aircraft-template-revision"
                value={formValues.revision_number}
                onChange={(event) => setFormValues((previous) => ({ ...previous, revision_number: event.target.value }))}
                className="mdm-template-input"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="aircraft-template-amendment" className="mdm-template-label">Amendment Number</Label>
              <Input
                id="aircraft-template-amendment"
                value={formValues.amendment_number}
                onChange={(event) => setFormValues((previous) => ({ ...previous, amendment_number: event.target.value }))}
                className="mdm-template-input"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-[hsl(var(--mdm-template-border))] pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void onSubmit()} disabled={submitting}>
              {submitting ? 'Saving...' : mode === 'create' ? 'Create Template' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
