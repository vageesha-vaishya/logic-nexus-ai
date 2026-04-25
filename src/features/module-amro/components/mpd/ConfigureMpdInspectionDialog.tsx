import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ConfigureMpdInspectionFormValues } from './useConfigureMpdState';

export type ConfigureMpdInspectionDialogContext = {
  mode: 'non-configured' | 'configured';
  recordId: string;
  taskTemplateId?: string;
  taskId?: string;
  title?: string;
  ataCode?: string;
  reference?: string;
  description?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: ConfigureMpdInspectionDialogContext | null;
  saving: boolean;
  onSubmit: (values: ConfigureMpdInspectionFormValues) => Promise<void> | void;
};

const DEFAULT_VALUES: ConfigureMpdInspectionFormValues = {
  inspection_type: 'Routine Inspection Recurring',
  ata_chapter: '',
  reference: '',
  description: '',
  done_on_date: '',
  applicable: true,
  work_order_no: '',
  license_no: '',
  place: '',
  actual_man_hours: '',
  remark: '',
  elapsed_hours: '',
  remaining_hours: '',
  elapsed_months: '',
  remaining_months: '',
  calculate_due_for_period_later: false,
  started_on_hours: '',
  current_hours: '',
  extension_hours: '',
  due_at_hours: '',
  started_on_months_date: '',
  current_months_date: '',
  extension_months: '',
  due_at_months_date: '',
  revision_no: '',
  page_no: '',
  book_no: '',
  source_doc: '',
  attachment_file_name: '',
  extension_date: '',
  approval_remark: '',
};

export function ConfigureMpdInspectionDialog({
  open,
  onOpenChange,
  context,
  saving,
  onSubmit,
}: Props) {
  const [values, setValues] = useState<ConfigureMpdInspectionFormValues>(DEFAULT_VALUES);

  const initialValues = useMemo<ConfigureMpdInspectionFormValues>(() => ({
    ...DEFAULT_VALUES,
    ata_chapter: context?.ataCode || '',
    reference: context?.reference || '',
    description: context?.description || context?.title || '',
  }), [context?.ataCode, context?.description, context?.reference, context?.title]);

  useEffect(() => {
    if (!open) return;
    setValues(initialValues);
  }, [initialValues, open]);

  const setField = <K extends keyof ConfigureMpdInspectionFormValues>(key: K, value: ConfigureMpdInspectionFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    await onSubmit(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[1200px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Assembly Inspection Status
            {context?.title ? ` [${context.title}]` : ''}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <section className="space-y-2 rounded-md border p-3">
            <h3 className="font-semibold">Monitoring Details</h3>
            <div className="space-y-2">
              <Label>Inspection Type</Label>
              <Input value={values.inspection_type} onChange={(e) => setField('inspection_type', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>ATA Chapter</Label>
              <Input value={values.ata_chapter} onChange={(e) => setField('ata_chapter', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input value={values.reference} onChange={(e) => setField('reference', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={values.description} onChange={(e) => setField('description', e.target.value)} rows={3} />
            </div>
          </section>

          <section className="space-y-2 rounded-md border p-3">
            <h3 className="font-semibold">Elapsed and Remaining Values</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Elapsed Hours</Label>
                <Input value={values.elapsed_hours} onChange={(e) => setField('elapsed_hours', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Remaining Hours</Label>
                <Input value={values.remaining_hours} onChange={(e) => setField('remaining_hours', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Elapsed Months</Label>
                <Input value={values.elapsed_months} onChange={(e) => setField('elapsed_months', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Remaining Months</Label>
                <Input value={values.remaining_months} onChange={(e) => setField('remaining_months', e.target.value)} />
              </div>
            </div>
          </section>

          <section className="space-y-2 rounded-md border p-3">
            <h3 className="font-semibold">Done On Details</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Done On</Label>
                <Input type="date" value={values.done_on_date} onChange={(e) => setField('done_on_date', e.target.value)} />
              </div>
              <div className="flex items-end gap-2 pb-2">
                <input
                  id="configure-mpd-applicable"
                  type="checkbox"
                  checked={values.applicable}
                  onChange={(e) => setField('applicable', e.target.checked)}
                />
                <Label htmlFor="configure-mpd-applicable">Applicable</Label>
              </div>
              <div className="space-y-1">
                <Label>Work Order No.</Label>
                <Input value={values.work_order_no} onChange={(e) => setField('work_order_no', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>License No.</Label>
                <Input value={values.license_no} onChange={(e) => setField('license_no', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Place</Label>
                <Input value={values.place} onChange={(e) => setField('place', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Actual Man Hours</Label>
                <Input value={values.actual_man_hours} onChange={(e) => setField('actual_man_hours', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Remark</Label>
              <Textarea value={values.remark} onChange={(e) => setField('remark', e.target.value)} rows={3} />
            </div>
          </section>

          <section className="space-y-2 rounded-md border p-3">
            <h3 className="font-semibold">Airframe Values</h3>
            <div className="flex items-center gap-2">
              <input
                id="configure-mpd-calc-due-later"
                type="checkbox"
                checked={values.calculate_due_for_period_later}
                onChange={(e) => setField('calculate_due_for_period_later', e.target.checked)}
              />
              <Label htmlFor="configure-mpd-calc-due-later">Calculate Due For Period Whichever Later</Label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Started On (Hours)</Label>
                <Input value={values.started_on_hours} onChange={(e) => setField('started_on_hours', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Current (Hours)</Label>
                <Input value={values.current_hours} onChange={(e) => setField('current_hours', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Extension (Hours)</Label>
                <Input value={values.extension_hours} onChange={(e) => setField('extension_hours', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Due At (Hours)</Label>
                <Input value={values.due_at_hours} onChange={(e) => setField('due_at_hours', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Started On (Months)</Label>
                <Input type="date" value={values.started_on_months_date} onChange={(e) => setField('started_on_months_date', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Current (Months)</Label>
                <Input type="date" value={values.current_months_date} onChange={(e) => setField('current_months_date', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Extension (Months)</Label>
                <Input value={values.extension_months} onChange={(e) => setField('extension_months', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Due At (Months)</Label>
                <Input type="date" value={values.due_at_months_date} onChange={(e) => setField('due_at_months_date', e.target.value)} />
              </div>
            </div>
          </section>

          <section className="space-y-2 rounded-md border p-3">
            <h3 className="font-semibold">Document Details</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Revision No.</Label>
                <Input value={values.revision_no} onChange={(e) => setField('revision_no', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Page No.</Label>
                <Input value={values.page_no} onChange={(e) => setField('page_no', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Book No.</Label>
                <Input value={values.book_no} onChange={(e) => setField('book_no', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Source Doc</Label>
                <Input value={values.source_doc} onChange={(e) => setField('source_doc', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Attach File</Label>
              <Input
                type="file"
                onChange={(e) => {
                  const fileName = e.target.files?.[0]?.name || '';
                  setField('attachment_file_name', fileName);
                }}
              />
              {values.attachment_file_name ? (
                <p className="text-xs text-muted-foreground">Selected: {values.attachment_file_name}</p>
              ) : null}
            </div>
          </section>

          <section className="space-y-2 rounded-md border p-3">
            <h3 className="font-semibold">Extension Details</h3>
            <div className="space-y-1">
              <Label>Extension Date</Label>
              <Input type="date" value={values.extension_date} onChange={(e) => setField('extension_date', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Approval Remark</Label>
              <Textarea value={values.approval_remark} onChange={(e) => setField('approval_remark', e.target.value)} rows={3} />
            </div>
          </section>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" type="button" onClick={() => window.print()} disabled={saving}>Print</Button>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={saving}>Back</Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ConfigureMpdInspectionDialog;
