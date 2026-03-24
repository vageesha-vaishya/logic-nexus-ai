import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Lead } from '@/pages/dashboard/leads-data';

export type LeadMasterDataFormValues = {
  first_name: string;
  last_name: string;
  company: string;
  title: string;
  email: string;
  phone: string;
  status: string;
  source: string;
  estimated_value: string;
  expected_close_date: string;
  description: string;
  notes: string;
};

type LeadModalMode = 'create' | 'update';

type LeadsMasterDataFormModalProps = {
  open: boolean;
  mode: LeadModalMode;
  initialLead: Lead | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: LeadMasterDataFormValues, mode: LeadModalMode, leadId?: string) => Promise<void>;
};

const STATUS_OPTIONS = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost', 'converted'];
const SOURCE_OPTIONS = ['website', 'referral', 'cold_call', 'email_campaign', 'social_media', 'event', 'partner', 'other'];

function createInitialValues(initialLead: Lead | null): LeadMasterDataFormValues {
  return {
    first_name: initialLead?.first_name || '',
    last_name: initialLead?.last_name || '',
    company: initialLead?.company || '',
    title: initialLead?.title || '',
    email: initialLead?.email || '',
    phone: initialLead?.phone || '',
    status: initialLead?.status || 'new',
    source: initialLead?.source || 'other',
    estimated_value: initialLead?.estimated_value !== null && initialLead?.estimated_value !== undefined ? String(initialLead.estimated_value) : '',
    expected_close_date: initialLead?.expected_close_date || '',
    description: initialLead?.description || '',
    notes: initialLead?.notes || '',
  };
}

export function LeadsMasterDataFormModal({
  open,
  mode,
  initialLead,
  onOpenChange,
  onSubmit,
}: LeadsMasterDataFormModalProps) {
  const [values, setValues] = useState<LeadMasterDataFormValues>(() => createInitialValues(initialLead));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues(createInitialValues(initialLead));
    setErrors({});
  }, [open, initialLead, mode]);

  const title = useMemo(() => 'Lead Create and Update', []);

  const validate = (formValues: LeadMasterDataFormValues): Record<string, string> => {
    const nextErrors: Record<string, string> = {};
    if (!formValues.first_name.trim()) nextErrors.first_name = 'First Name is required';
    if (!formValues.last_name.trim()) nextErrors.last_name = 'Last Name is required';
    if (!formValues.status.trim()) nextErrors.status = 'Status is required';
    if (!formValues.source.trim()) nextErrors.source = 'Source is required';

    if (formValues.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formValues.email.trim())) {
      nextErrors.email = 'Email is invalid';
    }

    if (formValues.estimated_value.trim()) {
      const parsed = Number(formValues.estimated_value);
      if (!Number.isFinite(parsed)) {
        nextErrors.estimated_value = 'Estimated Value must be numeric';
      } else if (parsed < 0) {
        nextErrors.estimated_value = 'Estimated Value must be at least 0';
      }
    }

    if (formValues.expected_close_date.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(formValues.expected_close_date.trim())) {
      nextErrors.expected_close_date = 'Expected Close must be in YYYY-MM-DD format';
    }
    return nextErrors;
  };

  const updateField = (field: keyof LeadMasterDataFormValues, value: string) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: '' }));
  };

  const handleSubmit = async () => {
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSubmitting(true);
    try {
      await onSubmit(values, mode, initialLead?.id);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setValues(createInitialValues(initialLead));
    setErrors({});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Master Data aligned lead creation and update workflow.</DialogDescription>
        </DialogHeader>
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="lead-master-first-name">First Name *</Label>
                <Input
                  id="lead-master-first-name"
                  value={values.first_name}
                  onChange={(event) => updateField('first_name', event.target.value)}
                  aria-invalid={Boolean(errors.first_name)}
                />
                {errors.first_name ? <p className="text-xs text-destructive">{errors.first_name}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-master-last-name">Last Name *</Label>
                <Input
                  id="lead-master-last-name"
                  value={values.last_name}
                  onChange={(event) => updateField('last_name', event.target.value)}
                  aria-invalid={Boolean(errors.last_name)}
                />
                {errors.last_name ? <p className="text-xs text-destructive">{errors.last_name}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-master-company">Company</Label>
                <Input id="lead-master-company" value={values.company} onChange={(event) => updateField('company', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-master-title">Title</Label>
                <Input id="lead-master-title" value={values.title} onChange={(event) => updateField('title', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-master-email">Email</Label>
                <Input
                  id="lead-master-email"
                  type="email"
                  value={values.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  aria-invalid={Boolean(errors.email)}
                />
                {errors.email ? <p className="text-xs text-destructive">{errors.email}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-master-phone">Phone</Label>
                <Input id="lead-master-phone" value={values.phone} onChange={(event) => updateField('phone', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Status *</Label>
                <Select value={values.status} onValueChange={(value) => updateField('status', value)}>
                  <SelectTrigger id="lead-master-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.status ? <p className="text-xs text-destructive">{errors.status}</p> : null}
              </div>
              <div className="space-y-2">
                <Label>Source *</Label>
                <Select value={values.source} onValueChange={(value) => updateField('source', value)}>
                  <SelectTrigger id="lead-master-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_OPTIONS.map((source) => (
                      <SelectItem key={source} value={source}>
                        {source}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.source ? <p className="text-xs text-destructive">{errors.source}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-master-estimated-value">Estimated Value</Label>
                <Input
                  id="lead-master-estimated-value"
                  type="number"
                  min={0}
                  step="any"
                  value={values.estimated_value}
                  onChange={(event) => updateField('estimated_value', event.target.value)}
                  aria-invalid={Boolean(errors.estimated_value)}
                />
                {errors.estimated_value ? <p className="text-xs text-destructive">{errors.estimated_value}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-master-expected-close">Expected Close</Label>
                <Input
                  id="lead-master-expected-close"
                  type="date"
                  value={values.expected_close_date}
                  onChange={(event) => updateField('expected_close_date', event.target.value)}
                  aria-invalid={Boolean(errors.expected_close_date)}
                />
                {errors.expected_close_date ? <p className="text-xs text-destructive">{errors.expected_close_date}</p> : null}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="lead-master-description">Description</Label>
                <Textarea
                  id="lead-master-description"
                  rows={4}
                  value={values.description}
                  onChange={(event) => updateField('description', event.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="lead-master-notes">Notes</Label>
                <Textarea id="lead-master-notes" rows={4} value={values.notes} onChange={(event) => updateField('notes', event.target.value)} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void handleSubmit()} disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {mode === 'create' ? 'Create' : 'Update Selected'}
              </Button>
              <Button variant="outline" onClick={handleReset} disabled={submitting}>Reset Form</Button>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}

export default LeadsMasterDataFormModal;
