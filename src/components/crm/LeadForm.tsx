import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useState, useEffect, useRef } from 'react';
import { toast } from "sonner";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, Bold, Italic, Underline, List, ListOrdered, Save, X } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { FormSection, FormGrid, FormItem as LayoutItem } from '@/components/forms/FormLayout';
import { FileUploadField } from '@/components/forms/AdvancedFields';
import { Switch } from '@/components/ui/switch';
import type { TransportOption } from '@/components/email/email-to-lead-helpers';
import { extractMaxPrice } from '@/components/email/email-to-lead-helpers';
import { ROLE_PERMISSIONS } from '@/config/permissions';
import { sanitizeRichTextHtml, stripHtmlTags } from '@/lib/utils/sanitizer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export const leadSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  company: z.string().optional(),
  title: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  status: z.enum(['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost']),
  source: z.enum(['website', 'referral', 'email', 'phone', 'social', 'event', 'other']),
  estimated_value: z.string().optional(),
  expected_close_date: z.string().min(1, 'Expected Close Date is required'),
  description: z.string().optional(),
  notes: z.string().optional(),
  tenant_id: z.string().min(1, 'Tenant is required'),
  franchise_id: z.string().optional(),
  service_id: z.string().min(1, 'Interested Service is required'),
  attachments: z.array(z.any()).default([]),
  lead_type: z.enum(['standard', 'enterprise', 'partner']).default('standard'),
  referral_name: z.string().optional(),
  decision_timeline: z.string().optional(),
  stakeholders_count: z.string().optional(),
  lost_reason: z.string().optional(),
}).superRefine((data, ctx) => {
  const hasEmail = !!(data.email && data.email.trim());
  const hasPhone = !!(data.phone && data.phone.trim());
  if (!hasEmail && !hasPhone) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['email'],
      message: 'Provide at least one contact: email or phone',
    });
  }
  if (data.source === 'referral' && !data.referral_name?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['referral_name'],
      message: 'Referral name is required when source is Referral',
    });
  }
  if (data.status === 'lost' && !data.lost_reason?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['lost_reason'],
      message: 'Loss reason is required when lead status is Lost',
    });
  }
  const requiresValue = data.lead_type === 'enterprise' || ['proposal', 'negotiation', 'won'].includes(data.status);
  if (requiresValue && !data.estimated_value?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['estimated_value'],
      message: 'Estimated value is required for this lead stage/type',
    });
  }
  if (data.lead_type === 'enterprise') {
    const stakeholders = Number(data.stakeholders_count || '0');
    if (!Number.isFinite(stakeholders) || stakeholders <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['stakeholders_count'],
        message: 'Stakeholders count is required for enterprise leads',
      });
    }
  }
  if (stripHtmlTags(data.description || '').length > 5000) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['description'],
      message: 'Description cannot exceed 5000 characters',
    });
  }
  if (stripHtmlTags(data.notes || '').length > 10000) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['notes'],
      message: 'Notes cannot exceed 10000 characters',
    });
  }
});

type LeadFormData = z.infer<typeof leadSchema>;
export type { LeadFormData };

interface LeadFormProps {
  initialData?: Partial<LeadFormData> & { id?: string };
  onSubmit: (data: LeadFormData) => Promise<void>;
  onSaveAndNew?: (data: LeadFormData) => Promise<void>;
  onAutoSave?: (data: LeadFormData) => Promise<void>;
  onCancel: () => void;
  suggestedService?: string;
  isSuggestingService?: boolean;
  recommendationSelection?: TransportOption | null;
  autoSave?: boolean;
  draftStorageKey?: string;
  sectionDescription?: string;
  hideNarrativeFields?: boolean;
}

export function LeadForm({
  initialData,
  onSubmit,
  onSaveAndNew,
  onAutoSave,
  onCancel,
  suggestedService,
  isSuggestingService,
  recommendationSelection,
  autoSave = false,
  draftStorageKey,
  sectionDescription = 'Complex entity form layout for lead profile and qualification',
  hideNarrativeFields = false,
}: LeadFormProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingData, setPendingData] = useState<LeadFormData | null>(null);
  const [autoSaveError, setAutoSaveError] = useState<string | null>(null);
  const autoSaveTimeoutRef = useRef<number | null>(null);
  const isAutoSavingRef = useRef(false);
  const draftSaveTimeoutRef = useRef<number | null>(null);
  const descriptionEditorRef = useRef<HTMLDivElement | null>(null);
  const notesEditorRef = useRef<HTMLDivElement | null>(null);
  const pendingSubmitModeRef = useRef<'save' | 'save_and_new'>('save');
  const { context, scopedDb } = useCRM();
  const [tenants, setTenants] = useState<any[]>([]);
  const [franchises, setFranchises] = useState<any[]>([]);
  const [currentFranchise, setCurrentFranchise] = useState<{ id: string; name: string } | null>(null);
  
  const form = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    mode: 'onChange',
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
      tenant_id: initialData?.tenant_id || context.tenantId || '',
      franchise_id: initialData?.franchise_id || context.franchiseId || '',
      service_id: (initialData as any)?.custom_fields?.service_id || '',
      attachments: [],
      lead_type: ((initialData as any)?.custom_fields?.lead_type as LeadFormData['lead_type'] | undefined) || 'standard',
      referral_name: ((initialData as any)?.custom_fields?.referral_name as string | undefined) || '',
      decision_timeline: ((initialData as any)?.custom_fields?.decision_timeline as string | undefined) || '',
      stakeholders_count: ((initialData as any)?.custom_fields?.stakeholders_count as string | undefined) || '',
      lost_reason: ((initialData as any)?.custom_fields?.lost_reason as string | undefined) || '',
    },
  });

  const watchedTenantId = form.watch('tenant_id');
  const watchedSource = form.watch('source');
  const watchedStatus = form.watch('status');
  const watchedLeadType = form.watch('lead_type');
  const watchedNotes = form.watch('notes');
  const watchedDescription = form.watch('description');
  const currentRole = context.isPlatformAdmin ? 'platform_admin' : context.isTenantAdmin ? 'tenant_admin' : context.isFranchiseAdmin ? 'franchise_admin' : 'user';
  const currentPermissions = ROLE_PERMISSIONS[currentRole];
  const canManageFiles = currentPermissions.includes('*') || currentPermissions.includes('files.manage');
  const canEditTenantScope = context.isPlatformAdmin || context.isTenantAdmin;

  useEffect(() => {
    if (context.isPlatformAdmin) {
      fetchTenants();
      if (watchedTenantId) {
        fetchFranchises(watchedTenantId);
      } else {
        setFranchises([]);
      }
    } else if (context.isTenantAdmin) {
      if (context.tenantId) fetchFranchises(context.tenantId);
    } else if (context.franchiseId) {
      fetchCurrentFranchise();
    }
  }, [context.isPlatformAdmin, context.isTenantAdmin, context.franchiseId, watchedTenantId]);

  // Debug: Log when LeadForm mounts/unmounts or receives new props
  useEffect(() => {
    console.log("LeadForm Mounted. Initial Service:", (initialData as any)?.custom_fields?.service_id);
    return () => console.log("LeadForm Unmounted");
  }, []);

  useEffect(() => {
    if (suggestedService) {
      console.log("LeadForm received suggestedService update:", suggestedService);
      // Clean the suggestion (remove brackets if present)
      const term = suggestedService.replace(/[[\]]/g, '').trim();
      
      // Set the free-text value directly
      if (term) {
        console.log("Setting service_id to:", term);
        // Use setValue with options to ensure it sticks
        form.setValue('service_id', term, { 
          shouldValidate: true, 
          shouldDirty: true, 
          shouldTouch: true 
        });

        // Also populate Notes field with the same value
        const currentNotes = form.getValues('notes') || '';
        // Avoid duplicating if already present
        if (!currentNotes.includes(term)) {
          const newNotes = currentNotes ? `${currentNotes}\n\nSuggested Service: ${term}` : `Suggested Service: ${term}`;
          form.setValue('notes', newNotes, {
            shouldValidate: true,
            shouldDirty: true,
            shouldTouch: true
          });
        }
        
        // Double check the value was set
        const currentVal = form.getValues('service_id');
        if (currentVal !== term) {
            console.warn("Warning: service_id mismatch after setValue!", { expected: term, actual: currentVal });
        } else {
            toast.success(`AI suggested service: ${term}`);
        }
      }
    }
  }, [suggestedService, form]);

  useEffect(() => {
    if (recommendationSelection) {
      const mode = recommendationSelection.mode?.trim();
      if (mode) {
        form.setValue('service_id', mode, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
      }
      const maxPrice = extractMaxPrice(recommendationSelection.price || '');
      if (maxPrice !== null && !isNaN(maxPrice)) {
        form.setValue('estimated_value', String(maxPrice), { shouldValidate: true, shouldDirty: true, shouldTouch: true });
      }
      const bestFor = recommendationSelection.bestFor?.trim();
      const interchange = recommendationSelection.interchangePoints?.trim();
      const currentNotes = form.getValues('notes') || '';
      const lines: string[] = [];
      if (bestFor && !currentNotes.includes(bestFor)) lines.push(`Best For: ${bestFor}`);
      if (interchange && !currentNotes.includes(interchange)) lines.push(`Interchange Points: ${interchange}`);
      if (lines.length > 0) {
        const newNotes = currentNotes ? `${currentNotes}\n\n${lines.join('\n')}` : lines.join('\n');
        form.setValue('notes', newNotes, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
      }
    }
  }, [recommendationSelection, form]);

  // Debug: Monitor service_id changes
  const currentServiceId = form.watch('service_id');
  useEffect(() => {
    console.log("Current service_id value:", currentServiceId);
  }, [currentServiceId]);

  const fetchTenants = async () => {
    // Pass true for isGlobal to avoid filtering tenants table by tenant_id (which doesn't exist)
    const { data } = await scopedDb
      .from('tenants', true)
      .select('id, name')
      .order('name');
    if (data) setTenants(data as any[]);
  };

  const fetchFranchises = async (tenantId: string) => {
    const { data } = await scopedDb
      .from('franchises')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .order('name');
    if (data) setFranchises(data as any[]);
  };

  const fetchCurrentFranchise = async () => {
    if (!context.franchiseId) return;
    const { data } = await scopedDb
      .from('franchises')
      .select('id, name')
      .eq('id', context.franchiseId)
      .single();
    if (data) setCurrentFranchise(data);
  };

  const { isSubmitting } = form.formState;
  const attachments = form.watch('attachments');
  const [signedUrlEnabled, setSignedUrlEnabled] = useState(false);

  const handleFormSubmit = (data: LeadFormData) => {
    setPendingData(data);
    setShowConfirmDialog(true);
  };

  const handleConfirm = async () => {
    if (pendingData) {
      setShowConfirmDialog(false);
      const mode = pendingSubmitModeRef.current;
      if (mode === 'save_and_new' && onSaveAndNew) {
        await onSaveAndNew(pendingData);
      } else {
        await onSubmit(pendingData);
      }
      pendingSubmitModeRef.current = 'save';
      setPendingData(null);
    }
  };

  const execRichText = (target: 'description' | 'notes', command: 'bold' | 'italic' | 'underline' | 'insertUnorderedList' | 'insertOrderedList') => {
    const editor = target === 'description' ? descriptionEditorRef.current : notesEditorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand(command);
    const value = sanitizeRichTextHtml(editor.innerHTML);
    form.setValue(target, value, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        pendingSubmitModeRef.current = 'save';
        form.handleSubmit(handleFormSubmit)();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [form]);

  useEffect(() => {
    if (!autoSave || !onAutoSave) return;
    const subscription = form.watch(() => {
      if (!form.formState.isDirty) return;
      if (autoSaveTimeoutRef.current) {
        window.clearTimeout(autoSaveTimeoutRef.current);
      }
      autoSaveTimeoutRef.current = window.setTimeout(async () => {
        if (isAutoSavingRef.current) return;
        const valid = await form.trigger();
        if (!valid) return;
        try {
          isAutoSavingRef.current = true;
          setAutoSaveError(null);
          const payload = form.getValues();
          await onAutoSave(payload);
          form.reset(payload);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Auto-save failed';
          setAutoSaveError(message);
        } finally {
          isAutoSavingRef.current = false;
        }
      }, 30000);
    });
    return () => {
      subscription.unsubscribe();
      if (autoSaveTimeoutRef.current) {
        window.clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [autoSave, form, onAutoSave]);

  useEffect(() => {
    if (!draftStorageKey) return;
    const raw = localStorage.getItem(draftStorageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<LeadFormData>;
      form.reset({
        ...form.getValues(),
        ...parsed,
      });
    } catch {
      return;
    }
  }, [draftStorageKey, form]);

  useEffect(() => {
    const current = watchedDescription || '';
    if (!descriptionEditorRef.current) return;
    if (descriptionEditorRef.current.innerHTML !== current) {
      descriptionEditorRef.current.innerHTML = current;
    }
  }, [watchedDescription]);

  useEffect(() => {
    const current = watchedNotes || '';
    if (!notesEditorRef.current) return;
    if (notesEditorRef.current.innerHTML !== current) {
      notesEditorRef.current.innerHTML = current;
    }
  }, [watchedNotes]);

  useEffect(() => {
    if (!draftStorageKey) return;
    const subscription = form.watch(() => {
      if (draftSaveTimeoutRef.current) {
        window.clearTimeout(draftSaveTimeoutRef.current);
      }
      draftSaveTimeoutRef.current = window.setTimeout(() => {
        try {
          const current = form.getValues();
          localStorage.setItem(draftStorageKey, JSON.stringify(current));
        } catch {
          return;
        }
      }, 350);
    });
    return () => {
      subscription.unsubscribe();
      if (draftSaveTimeoutRef.current) {
        window.clearTimeout(draftSaveTimeoutRef.current);
      }
    };
  }, [draftStorageKey, form]);

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
        {autoSave && autoSaveError ? (
          <p className="text-xs text-destructive">{autoSaveError}</p>
        ) : null}

        <FormSection
          title={initialData?.id ? 'Lead Details' : 'New Lead Details'}
          description={sectionDescription}
          actions={
            <TooltipProvider>
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={onCancel}
                      disabled={isSubmitting}
                      aria-label="Cancel lead form"
                      title="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Cancel</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="submit"
                      size="icon"
                      disabled={isSubmitting}
                      onClick={() => {
                        pendingSubmitModeRef.current = 'save';
                      }}
                      aria-label={initialData?.id ? 'Save lead' : 'Create lead'}
                      title={initialData?.id ? 'Save' : 'Create Lead'}
                    >
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{initialData?.id ? 'Save' : 'Create Lead'}</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          }
        >
          <FormGrid columns={4}>
              <>
                {context.isPlatformAdmin && (
                  <LayoutItem span={2}>
                    <FormField
                      control={form.control}
                      name="tenant_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tenant *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || undefined} disabled={!canEditTenantScope}>
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
                  </LayoutItem>
                )}

                {(context.isTenantAdmin || context.isPlatformAdmin) && franchises.length > 0 && (
                  <LayoutItem span={2}>
                    <FormField
                      control={form.control}
                      name="franchise_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Franchise</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || undefined} disabled={!canEditTenantScope}>
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
                  </LayoutItem>
                )}

                {!context.isTenantAdmin && !context.isPlatformAdmin && currentFranchise && (
                  <LayoutItem span={2}>
                    <div className="space-y-2">
                      <FormLabel>Franchise</FormLabel>
                      <Input value={currentFranchise.name} disabled readOnly className="bg-muted" />
                    </div>
                  </LayoutItem>
                )}

                <LayoutItem span={2}>
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
                </LayoutItem>

                <LayoutItem span={2}>
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
                </LayoutItem>

                <LayoutItem span={2}>
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
                </LayoutItem>

                <LayoutItem span={2}>
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
                </LayoutItem>

                <LayoutItem span={2}>
                  <FormField
                    control={form.control}
                    name="lead_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lead Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="standard">Standard</SelectItem>
                            <SelectItem value="enterprise">Enterprise</SelectItem>
                            <SelectItem value="partner">Partner</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </LayoutItem>
              </>
              <>
                <LayoutItem span={2}>
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
                </LayoutItem>

                <LayoutItem span={2}>
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
                </LayoutItem>

                <LayoutItem span={2}>
                  <FormField
                    control={form.control}
                    name="source"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Source *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
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
                </LayoutItem>

                {watchedSource === 'referral' && (
                  <LayoutItem span={2}>
                    <FormField
                      control={form.control}
                      name="referral_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Referral Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Referrer name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </LayoutItem>
                )}
              </>
              <>
                <LayoutItem span={2}>
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
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
                </LayoutItem>

                <LayoutItem span={2}>
                  <FormField
                    control={form.control}
                    name="expected_close_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expected Close Date *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </LayoutItem>

                <LayoutItem span={4}>
                  <FormField
                    control={form.control}
                    name="service_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {isSuggestingService ? (
                            <span className="flex items-center gap-2">
                              Interested Service
                              <span className="text-xs text-muted-foreground animate-pulse">(AI Analyzing...)</span>
                            </span>
                          ) : (
                            "Interested Service *"
                          )}
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Sea Freight" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </LayoutItem>

                <LayoutItem span={2}>
                  <FormField
                    control={form.control}
                    name="estimated_value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estimated Value {(watchedLeadType === 'enterprise' || ['proposal', 'negotiation', 'won'].includes(watchedStatus)) ? '*' : ''}</FormLabel>
                        <FormControl>
                          <Input placeholder="10000" type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </LayoutItem>

                {watchedLeadType === 'enterprise' && (
                  <LayoutItem span={2}>
                    <FormField
                      control={form.control}
                      name="stakeholders_count"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stakeholders Count *</FormLabel>
                          <FormControl>
                            <Input placeholder="4" type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </LayoutItem>
                )}

                {watchedLeadType === 'enterprise' && (
                  <LayoutItem span={4}>
                    <FormField
                      control={form.control}
                      name="decision_timeline"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Decision Timeline</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. 30-45 days" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </LayoutItem>
                )}

                {watchedStatus === 'lost' && (
                  <LayoutItem span={4}>
                    <FormField
                      control={form.control}
                      name="lost_reason"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Loss Reason *</FormLabel>
                          <FormControl>
                            <Textarea className="min-h-[80px]" placeholder="What caused this lead to be lost?" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </LayoutItem>
                )}

                {!hideNarrativeFields ? (
                  <>
                    <LayoutItem span={4}>
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/20 p-1">
                              <Button type="button" variant="ghost" size="sm" onClick={() => execRichText('description', 'bold')} aria-label="Description Bold"><Bold className="h-4 w-4" /></Button>
                              <Button type="button" variant="ghost" size="sm" onClick={() => execRichText('description', 'italic')} aria-label="Description Italic"><Italic className="h-4 w-4" /></Button>
                              <Button type="button" variant="ghost" size="sm" onClick={() => execRichText('description', 'underline')} aria-label="Description Underline"><Underline className="h-4 w-4" /></Button>
                              <Button type="button" variant="ghost" size="sm" onClick={() => execRichText('description', 'insertUnorderedList')} aria-label="Description Unordered list"><List className="h-4 w-4" /></Button>
                              <Button type="button" variant="ghost" size="sm" onClick={() => execRichText('description', 'insertOrderedList')} aria-label="Description Ordered list"><ListOrdered className="h-4 w-4" /></Button>
                            </div>
                            <FormControl>
                              <div
                                ref={descriptionEditorRef}
                                contentEditable
                                className="min-h-[120px] rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                onInput={(event) => field.onChange(sanitizeRichTextHtml((event.target as HTMLDivElement).innerHTML))}
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">{stripHtmlTags(field.value || '').length}/5000 characters</p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </LayoutItem>

                    <LayoutItem span={4}>
                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notes</FormLabel>
                            <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/20 p-1">
                              <Button type="button" variant="ghost" size="sm" onClick={() => execRichText('notes', 'bold')} aria-label="Bold"><Bold className="h-4 w-4" /></Button>
                              <Button type="button" variant="ghost" size="sm" onClick={() => execRichText('notes', 'italic')} aria-label="Italic"><Italic className="h-4 w-4" /></Button>
                              <Button type="button" variant="ghost" size="sm" onClick={() => execRichText('notes', 'underline')} aria-label="Underline"><Underline className="h-4 w-4" /></Button>
                              <Button type="button" variant="ghost" size="sm" onClick={() => execRichText('notes', 'insertUnorderedList')} aria-label="Unordered list"><List className="h-4 w-4" /></Button>
                              <Button type="button" variant="ghost" size="sm" onClick={() => execRichText('notes', 'insertOrderedList')} aria-label="Ordered list"><ListOrdered className="h-4 w-4" /></Button>
                            </div>
                            <FormControl>
                              <div
                                ref={notesEditorRef}
                                contentEditable
                                className="min-h-[120px] rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                onInput={(event) => field.onChange(sanitizeRichTextHtml((event.target as HTMLDivElement).innerHTML))}
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">{stripHtmlTags(field.value || '').length}/10000 characters</p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </LayoutItem>
                  </>
                ) : null}

                <LayoutItem span={4}>
                  <div className="space-y-4 rounded-md border p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">Attachments</div>
                      <div className="flex items-center gap-2 text-sm">
                        <Switch checked={signedUrlEnabled} onCheckedChange={setSignedUrlEnabled} id="lead-signed-url" />
                        <label htmlFor="lead-signed-url" className="text-sm">Signed URL</label>
                      </div>
                    </div>
                    {canManageFiles ? (
                      <FileUploadField control={form.control} name="attachments" label="Attachments" />
                    ) : (
                      <p className="text-sm text-muted-foreground">Your role cannot upload attachments.</p>
                    )}
                    {attachments && Array.isArray(attachments) && attachments.length > 0 ? (
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
                    ) : (
                      <p className="text-sm text-muted-foreground">No files selected yet</p>
                    )}
                  </div>
                </LayoutItem>
              </>
          </FormGrid>
        </FormSection>

        <div className="flex justify-end gap-3">
          {onSaveAndNew && !initialData?.id ? (
            <Button
              type="button"
              variant="secondary"
              disabled={isSubmitting}
              onClick={() => {
                pendingSubmitModeRef.current = 'save_and_new';
                form.handleSubmit(handleFormSubmit)();
              }}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save & New
            </Button>
          ) : null}
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
