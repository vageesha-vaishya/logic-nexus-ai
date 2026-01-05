import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { FormSection, FormGrid } from '@/components/forms/FormLayout';
import { AsyncComboboxField, FileUploadField } from '@/components/forms/AdvancedFields';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const leadSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  company: z.string().optional(),
  title: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  status: z.enum(['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost']),
  source: z.enum(['website', 'referral', 'email', 'phone', 'social', 'event', 'other']),
  estimated_value: z.string().optional(),
  expected_close_date: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  tenant_id: z.string().optional(),
  franchise_id: z.string().optional(),
  service_id: z.string().optional(),
  attachments: z.array(z.any()).default([]),
}).refine((data) => {
  const hasEmail = !!(data.email && data.email.trim());
  const hasPhone = !!(data.phone && data.phone.trim());
  return hasEmail || hasPhone;
}, {
  path: ['email'],
  message: 'Provide at least one contact: email or phone',
});

type LeadFormData = z.infer<typeof leadSchema>;
export type { LeadFormData };

interface LeadFormProps {
  initialData?: Partial<LeadFormData> & { id?: string };
  onSubmit: (data: LeadFormData) => Promise<void>;
  onCancel: () => void;
}

export function LeadForm({ initialData, onSubmit, onCancel }: LeadFormProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingData, setPendingData] = useState<LeadFormData | null>(null);
  const { supabase, context } = useCRM();
  const [tenants, setTenants] = useState<any[]>([]);
  const [franchises, setFranchises] = useState<any[]>([]);
  
  const form = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      first_name: initialData?.first_name || '',
      last_name: initialData?.last_name || '',
      company: initialData?.company || '',
      title: initialData?.title || '',
      email: initialData?.email || '',
      phone: initialData?.phone || '',
      status: initialData?.status || 'new',
      source: initialData?.source || 'other',
      estimated_value: initialData?.estimated_value || '',
      expected_close_date: initialData?.expected_close_date || '',
      description: initialData?.description || '',
      notes: initialData?.notes || '',
      tenant_id: initialData?.tenant_id || '',
      franchise_id: initialData?.franchise_id || '',
      service_id: (initialData as any)?.custom_fields?.service_id || '',
      attachments: [],
    },
  });

  useEffect(() => {
    if (context.isPlatformAdmin) {
      fetchTenants();
    } else if (context.isTenantAdmin) {
      fetchFranchises();
    }
  }, [context.isPlatformAdmin, context.isTenantAdmin]);

  const fetchTenants = async () => {
    const { data } = await supabase.from('tenants').select('id, name').order('name');
    if (data) setTenants(data);
  };

  const fetchFranchises = async () => {
    if (!context.tenantId) return;
    const { data } = await supabase
      .from('franchises')
      .select('id, name')
      .eq('tenant_id', context.tenantId)
      .order('name');
    if (data) setFranchises(data);
  };

  const { isSubmitting } = form.formState;
  const attachments = form.watch('attachments');
  const [signedUrlEnabled, setSignedUrlEnabled] = useState(false);
  const values = form.getValues();
  const fields = [
    values.first_name,
    values.last_name,
    values.email,
    values.phone,
    values.company,
    values.title,
    values.description,
    values.notes,
  ];
  const filledCount = fields.filter((v) => typeof v === 'string' ? v.trim().length > 0 : !!v).length;
  const score = Math.round((filledCount / fields.length) * 100);
  const label = score >= 80 ? 'Strong' : score >= 50 ? 'Moderate' : 'Weak';
  const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : 'D';
  const color = score >= 80 ? 'text-green-600 dark:text-green-300' : score >= 50 ? 'text-yellow-600 dark:text-yellow-300' : 'text-red-600 dark:text-red-300';

  const handleFormSubmit = (data: LeadFormData) => {
    setPendingData(data);
    setShowConfirmDialog(true);
  };

  const handleConfirm = async () => {
    if (pendingData) {
      setShowConfirmDialog(false);
      await onSubmit(pendingData);
      setPendingData(null);
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <div className="space-y-1">
                <h3 className="font-semibold text-lg">Lead Qualification Score</h3>
                <p className="text-sm text-muted-foreground">AI-driven score based on completeness and engagement</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 justify-end">
                  <span className={`text-3xl font-bold ${color}`}>{score}</span>
                  <span className="text-muted-foreground">/ 100</span>
                </div>
                <Badge variant="outline" className={`${color} border-current`}>{label} (Grade {grade})</Badge>
              </div>
            </div>
            <Progress value={score} className="h-2" />
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          {context.isPlatformAdmin && (
            <FormField
              control={form.control}
              name="tenant_id"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Tenant *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select tenant" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {tenants.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {context.isTenantAdmin && franchises.length > 0 && (
            <FormField
              control={form.control}
              name="franchise_id"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Franchise</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select franchise" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {franchises.map((franchise) => (
                        <SelectItem key={franchise.id} value={franchise.id}>
                          {franchise.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="first_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name *</FormLabel>
                <FormControl>
                  <Input placeholder="John" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="last_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name *</FormLabel>
                <FormControl>
                  <Input placeholder="Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="company"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company</FormLabel>
                <FormControl>
                  <Input placeholder="Acme Corp" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="CEO" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="john@example.com" type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input placeholder="+1 (555) 123-4567" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="qualified">Qualified</SelectItem>
                    <SelectItem value="proposal">Proposal</SelectItem>
                    <SelectItem value="negotiation">Negotiation</SelectItem>
                    <SelectItem value="won">Won</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="source"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Source *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="social">Social Media</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <AsyncComboboxField
            control={form.control}
            name="service_id"
            label="Interested Service"
            placeholder="Search services..."
            className="col-span-2"
          />

          <FormField
            control={form.control}
            name="estimated_value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estimated Value</FormLabel>
                <FormControl>
                  <Input placeholder="10000" type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="expected_close_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Expected Close Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe the opportunity..."
                    className="min-h-[80px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Additional notes..."
                    className="min-h-[80px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormSection
          title="Attachments"
          description="Upload related documents (e.g., proposals, brochures)"
          actions={
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-sm">
                <Switch checked={signedUrlEnabled} onCheckedChange={setSignedUrlEnabled} id="lead-signed-url" />
                <label htmlFor="lead-signed-url" className="text-sm">Signed URL</label>
              </div>
            </div>
          }
        >
          <FormGrid columns={1}>
            <FileUploadField control={form.control} name="attachments" label="Attachments" />
            {attachments && Array.isArray(attachments) && attachments.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Selected files:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {attachments.map((f: File, idx: number) => (
                    <li key={`${f.name}-${idx}`} className="flex items-center justify-between">
                      <span className="truncate">
                        <span className="font-medium">{f.name}</span>
                        <span className="text-muted-foreground"> • {f.type || 'unknown'}</span>
                      </span>
                      <span className="text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</span>
                    </li>
                  ))}
                </ul>
                {signedUrlEnabled && (
                  <p className="text-xs text-muted-foreground">
                    Signed URL enabled: in production, generate secure file links via Supabase Storage.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No files selected yet</p>
            )}
          </FormGrid>
        </FormSection>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initialData?.id ? 'Update Lead' : 'Create Lead'}
          </Button>
        </div>
        </form>
      </Form>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm {initialData?.id ? 'Update' : 'Create'}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {initialData?.id ? 'update' : 'create'} this lead?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
