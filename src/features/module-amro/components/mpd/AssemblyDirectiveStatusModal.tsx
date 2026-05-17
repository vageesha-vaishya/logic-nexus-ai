import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import type { DirectiveRecord } from './useDirectivesState';

export type AssemblyDirectiveStatusFormData = {
  doneOn: string;
  doneOnApplicable: boolean;
  workOrderNo: string;
  licenseNo: string;
  place: string;
  actualManHours: string;
  methodOfCompliance: string;
  remark: string;
  revisionNo: string;
  pageNo: string;
  bookNo: string;
  sourceDoc: string;
  extensionDate: string;
  approvalRemark: string;
  calculateDueForPeriod: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (formData: AssemblyDirectiveStatusFormData) => void;
  directive: DirectiveRecord | null;
  aircraftRegistration: string;
  aircraftModel: string;
  isSaving?: boolean;
};

const defaultForm: AssemblyDirectiveStatusFormData = {
  doneOn: '',
  doneOnApplicable: false,
  workOrderNo: '',
  licenseNo: '',
  place: '',
  actualManHours: '',
  methodOfCompliance: '',
  remark: '',
  revisionNo: '',
  pageNo: '',
  bookNo: '',
  sourceDoc: '',
  extensionDate: '',
  approvalRemark: '',
  calculateDueForPeriod: false,
};

export function AssemblyDirectiveStatusModal({
  open,
  onClose,
  onSave,
  directive,
  aircraftRegistration,
  aircraftModel,
  isSaving = false,
}: Props) {
  const [form, setForm] = useState<AssemblyDirectiveStatusFormData>(defaultForm);

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      setForm(defaultForm);
      onClose();
    }
  }

  function set(field: keyof AssemblyDirectiveStatusFormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSave() {
    onSave(form);
  }

  const titleSuffix = aircraftModel && aircraftRegistration
    ? `[Model: ${aircraftModel}  SerialNo: ${aircraftRegistration}]`
    : aircraftRegistration
      ? `[${aircraftRegistration}]`
      : '';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            Assembly Directives Status {titleSuffix} [New]
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2 text-sm">
          {/* Monitoring Details */}
          <section>
            <h3 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">Monitoring Details</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <Label className="text-xs">Directive Type</Label>
                <Input value={directive?.directives_type_label ?? ''} readOnly className="bg-muted mt-1 h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">ATA Chapter</Label>
                <Input value={directive?.ata_code ?? ''} readOnly className="bg-muted mt-1 h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Directive Number (Code/Form)</Label>
                <Input value={directive?.mpd_code ?? ''} readOnly className="bg-muted mt-1 h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Reference AMP</Label>
                <Input value={directive?.reference_amp ?? ''} readOnly className="bg-muted mt-1 h-8 text-xs" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Description</Label>
                <Input value={directive?.description ?? ''} readOnly className="bg-muted mt-1 h-8 text-xs" />
              </div>
            </div>
          </section>

          <Separator />

          {/* Elapsed and Remaining Values */}
          <section>
            <h3 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">Elapsed and Remaining Values</h3>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Period</th>
                    <th className="text-left px-3 py-2 font-medium">Frequency</th>
                    <th className="text-left px-3 py-2 font-medium">Days</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t">
                    <td className="px-3 py-2">Hours</td>
                    <td className="px-3 py-2">{directive?.interval_hours ?? '—'}</td>
                    <td className="px-3 py-2">—</td>
                  </tr>
                  <tr className="border-t">
                    <td className="px-3 py-2">Cycles</td>
                    <td className="px-3 py-2">{directive?.interval_cycles ?? '—'}</td>
                    <td className="px-3 py-2">—</td>
                  </tr>
                  <tr className="border-t">
                    <td className="px-3 py-2">Months</td>
                    <td className="px-3 py-2">{directive?.interval_months ?? '—'}</td>
                    <td className="px-3 py-2">{directive?.interval_months != null ? String(Math.round(directive.interval_months * 30.44)) : '—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Note: Days column shows approximate calendar days.</p>
          </section>

          <Separator />

          {/* Done On Details */}
          <section>
            <h3 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">Done On Details</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <Label className="text-xs">Done On</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="date"
                    value={form.doneOn}
                    onChange={(e) => set('doneOn', e.target.value)}
                    className="h-8 text-xs flex-1"
                  />
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      id="doneOnApplicable"
                      checked={form.doneOnApplicable}
                      onCheckedChange={(v) => set('doneOnApplicable', Boolean(v))}
                    />
                    <Label htmlFor="doneOnApplicable" className="text-xs cursor-pointer">Applicable</Label>
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-xs">Work Order No.</Label>
                <Input
                  value={form.workOrderNo}
                  onChange={(e) => set('workOrderNo', e.target.value)}
                  className="mt-1 h-8 text-xs"
                  placeholder="Work order number"
                />
              </div>
              <div>
                <Label className="text-xs">License No.</Label>
                <Input
                  value={form.licenseNo}
                  onChange={(e) => set('licenseNo', e.target.value)}
                  className="mt-1 h-8 text-xs"
                  placeholder="License number"
                />
              </div>
              <div>
                <Label className="text-xs">Place</Label>
                <Input
                  value={form.place}
                  onChange={(e) => set('place', e.target.value)}
                  className="mt-1 h-8 text-xs"
                  placeholder="Place"
                />
              </div>
              <div>
                <Label className="text-xs">Actual Man Hours</Label>
                <Input
                  type="number"
                  value={form.actualManHours}
                  onChange={(e) => set('actualManHours', e.target.value)}
                  className="mt-1 h-8 text-xs"
                  placeholder="Hours"
                  min={0}
                  step={0.5}
                />
              </div>
              <div>
                <Label className="text-xs">Method Of Compliance</Label>
                <Input
                  value={form.methodOfCompliance}
                  onChange={(e) => set('methodOfCompliance', e.target.value)}
                  className="mt-1 h-8 text-xs"
                  placeholder="Method of compliance"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Remark</Label>
                <Input
                  value={form.remark}
                  onChange={(e) => set('remark', e.target.value)}
                  className="mt-1 h-8 text-xs"
                  placeholder="Remark"
                />
              </div>
            </div>
          </section>

          <Separator />

          {/* Airframe Values */}
          <section>
            <h3 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">Airframe Values</h3>
            <div className="flex items-center gap-2 mb-3">
              <Checkbox
                id="calculateDue"
                checked={form.calculateDueForPeriod}
                onCheckedChange={(v) => set('calculateDueForPeriod', Boolean(v))}
              />
              <Label htmlFor="calculateDue" className="text-xs cursor-pointer">Calculate Due For Period — Whichever Later</Label>
            </div>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Period</th>
                    <th className="text-left px-3 py-2 font-medium">Frequency</th>
                    <th className="text-left px-3 py-2 font-medium">Done On Starts</th>
                    <th className="text-left px-3 py-2 font-medium">Current</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t">
                    <td className="px-3 py-2">Hours</td>
                    <td className="px-3 py-2">{directive?.interval_hours ?? '—'}</td>
                    <td className="px-3 py-2">—</td>
                    <td className="px-3 py-2">—</td>
                  </tr>
                  <tr className="border-t">
                    <td className="px-3 py-2">Cycles</td>
                    <td className="px-3 py-2">{directive?.interval_cycles ?? '—'}</td>
                    <td className="px-3 py-2">—</td>
                    <td className="px-3 py-2">—</td>
                  </tr>
                  <tr className="border-t">
                    <td className="px-3 py-2">Months</td>
                    <td className="px-3 py-2">{directive?.interval_months ?? '—'}</td>
                    <td className="px-3 py-2">{form.doneOn || '—'}</td>
                    <td className="px-3 py-2">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Note: Current values will be populated from aircraft records after configuration.</p>
          </section>

          <Separator />

          {/* Document Details */}
          <section>
            <h3 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">Document Details</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <Label className="text-xs">Revision No.</Label>
                <Input
                  value={form.revisionNo}
                  onChange={(e) => set('revisionNo', e.target.value)}
                  className="mt-1 h-8 text-xs"
                  placeholder="Revision number"
                />
              </div>
              <div>
                <Label className="text-xs">Page No.</Label>
                <Input
                  value={form.pageNo}
                  onChange={(e) => set('pageNo', e.target.value)}
                  className="mt-1 h-8 text-xs"
                  placeholder="Page number"
                />
              </div>
              <div>
                <Label className="text-xs">Book No.</Label>
                <Input
                  value={form.bookNo}
                  onChange={(e) => set('bookNo', e.target.value)}
                  className="mt-1 h-8 text-xs"
                  placeholder="Book number"
                />
              </div>
              <div>
                <Label className="text-xs">Source Doc</Label>
                <Input
                  value={form.sourceDoc}
                  onChange={(e) => set('sourceDoc', e.target.value)}
                  className="mt-1 h-8 text-xs"
                  placeholder="Source document"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Attach File</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input type="file" className="h-8 text-xs flex-1" />
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs">
                    Remove Attachment
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <Separator />

          {/* Extension Details */}
          <section>
            <h3 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">Extension Details</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <Label className="text-xs">Extension Date</Label>
                <Input
                  type="date"
                  value={form.extensionDate}
                  onChange={(e) => set('extensionDate', e.target.value)}
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Approval Remark</Label>
                <Input
                  value={form.approvalRemark}
                  onChange={(e) => set('approvalRemark', e.target.value)}
                  className="mt-1 h-8 text-xs"
                  placeholder="Approval remark"
                />
              </div>
            </div>
          </section>
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button onClick={handleSave} disabled={isSaving} size="sm">
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="outline" size="sm" disabled>
            Print
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSaving}>
            Back
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
