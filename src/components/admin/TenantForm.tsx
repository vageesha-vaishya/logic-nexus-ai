import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useState, useEffect } from 'react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { CrudFormLayout } from '@/components/system/CrudFormLayout';
import { FormSection } from '@/components/system/FormSection';
import { FormStepper } from '@/components/system/FormStepper';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DomainService, PlatformDomain } from '@/services/DomainService';
import { useCRM } from '@/hooks/useCRM';

const tenantSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  slug: z.string().min(2, 'Slug must be at least 2 characters').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  domain_id: z.string().min(1, 'Business Domain is required'),
  domain: z.string().optional(),
  logo_url: z.string().url().optional().or(z.literal('')),
  is_active: z.boolean().default(true),
  settings: z.string().optional(),
  demographics_age_group: z.string().optional(),
  demographics_gender: z.string().optional(),
  demographics_location_country: z.string().optional(),
  demographics_location_state: z.string().optional(),
  demographics_location_city: z.string().optional(),
  contact_primary_name: z.string().optional(),
  contact_primary_email: z.string().email('Invalid email').optional().or(z.literal('')),
  contact_primary_phone: z.string().optional(),
  contact_secondary_name: z.string().optional(),
  contact_secondary_email: z.string().email('Invalid email').optional().or(z.literal('')),
  contact_secondary_phone: z.string().optional(),
  contact_emergency_name: z.string().optional(),
  contact_emergency_phone: z.string().optional(),
  channels_email: z.string().optional(),
  channels_phone: z.string().optional(),
  channels_twitter: z.string().optional(),
  channels_linkedin: z.string().optional(),
  channels_facebook: z.string().optional(),
  legal_name: z.string().optional(),
  registered_address: z.string().optional(),
  tax_id: z.string().optional(),
  default_payment_terms: z.string().optional(),
  tax_jurisdiction: z.string().optional(),
  tax_registration_type: z.string().optional(),
  gstin: z.string().optional(),
  vat_number: z.string().optional(),
  cin_or_registration_number: z.string().optional(),
  kyc_status: z.string().optional(),
  legal_emergency_contact_name: z.string().optional(),
  legal_emergency_contact_phone: z.string().optional(),
  data_residency_region: z.string().optional(),
  data_residency_legal_basis: z.string().optional(),
  data_residency_retention_policy: z.string().optional(),
  data_residency_encryption_required: z.boolean().default(true),
  support_preferred_channel: z.string().optional(),
  support_escalation_level: z.string().optional(),
});

type TenantFormValues = z.infer<typeof tenantSchema>;

interface TenantFormProps {
  tenant?: any;
  onSuccess?: () => void;
}

export function TenantForm({ tenant, onSuccess }: TenantFormProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { scopedDb, supabase } = useCRM();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingData, setPendingData] = useState<TenantFormValues | null>(null);
  const [domains, setDomains] = useState<PlatformDomain[]>([]);
  const [tenantProfile, setTenantProfile] = useState<any>(null);

  useEffect(() => {
    if (!DomainService) {
      console.error('DomainService is undefined');
      return;
    }
    
    DomainService.getAllDomains()
      .then((data) => {
        // Sort domains alphabetically by name
        const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name));
        setDomains(sorted);
      })
      .catch((err) => {
        console.error('Failed to load domains', err);
        const message = err?.message || (err instanceof Error ? err.message : 'Unknown error loading domains');
        toast({ 
          title: 'Error Loading Domains', 
          description: message, 
          variant: 'destructive' 
        });
      });
  }, [toast]);

  useEffect(() => {
    const loadTenantProfile = async () => {
      if (!tenant?.id) return;

      try {
        const { data, error } = await scopedDb
          .from('tenant_profile')
          .select('*')
          .eq('tenant_id', tenant.id)
          .maybeSingle();

        if (error) throw error;
        if (data) setTenantProfile(data);
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error?.message || 'Failed to load tenant profile',
          variant: 'destructive',
        });
      }
    };

    loadTenantProfile();
  }, [tenant?.id, scopedDb, toast]);

  const form = useForm<TenantFormValues>({
    resolver: zodResolver(tenantSchema),
    defaultValues: {
      name: tenant?.name || '',
      slug: tenant?.slug || '',
      domain_id: tenant?.domain_id || '',
      domain: tenant?.domain || '',
      logo_url: tenant?.logo_url || '',
      is_active: tenant?.is_active ?? true,
      settings: tenant?.settings ? JSON.stringify(tenant.settings, null, 2) : '',
      demographics_age_group: tenant?.settings?.demographics?.age_group || '',
      demographics_gender: tenant?.settings?.demographics?.gender || '',
      demographics_location_country: tenant?.settings?.demographics?.location?.country || '',
      demographics_location_state: tenant?.settings?.demographics?.location?.state || '',
      demographics_location_city: tenant?.settings?.demographics?.location?.city || '',
      contact_primary_name: tenant?.settings?.contacts?.primary?.name || '',
      contact_primary_email: tenant?.settings?.contacts?.primary?.email || '',
      contact_primary_phone: tenant?.settings?.contacts?.primary?.phone || '',
      contact_secondary_name: tenant?.settings?.contacts?.secondary?.name || '',
      contact_secondary_email: tenant?.settings?.contacts?.secondary?.email || '',
      contact_secondary_phone: tenant?.settings?.contacts?.secondary?.phone || '',
      contact_emergency_name: tenant?.settings?.contacts?.emergency?.name || '',
      contact_emergency_phone: tenant?.settings?.contacts?.emergency?.phone || '',
      channels_email: tenant?.settings?.channels?.email || '',
      channels_phone: tenant?.settings?.channels?.phone || '',
      channels_twitter: tenant?.settings?.channels?.social?.twitter || '',
      channels_linkedin: tenant?.settings?.channels?.social?.linkedin || '',
      channels_facebook: tenant?.settings?.channels?.social?.facebook || '',
      legal_name: '',
      registered_address: '',
      tax_id: '',
      default_payment_terms: '',
      tax_jurisdiction: '',
      tax_registration_type: '',
      gstin: '',
      vat_number: '',
      cin_or_registration_number: '',
      kyc_status: '',
      legal_emergency_contact_name: '',
      legal_emergency_contact_phone: '',
      data_residency_region: tenant?.settings?.data_residency?.region || '',
      data_residency_legal_basis: tenant?.settings?.data_residency?.legal_basis || '',
      data_residency_retention_policy: tenant?.settings?.data_residency?.retention_policy || '',
      data_residency_encryption_required: tenant?.settings?.data_residency?.encryption_required ?? true,
      support_preferred_channel: tenant?.settings?.support?.preferred_channel || '',
      support_escalation_level: tenant?.settings?.support?.escalation_level || '',
    },
  });

  useEffect(() => {
    if (!tenantProfile) return;

    form.reset({
      ...form.getValues(),
      legal_name: tenantProfile.legal_name || '',
      registered_address: tenantProfile.registered_address || '',
      tax_id: tenantProfile.tax_id || '',
      default_payment_terms: tenantProfile.default_payment_terms || '',
      tax_jurisdiction: tenantProfile.tax_jurisdiction || '',
      tax_registration_type: tenantProfile.tax_registration_type || '',
      gstin: tenantProfile.gstin || '',
      vat_number: tenantProfile.vat_number || '',
      cin_or_registration_number: tenantProfile.cin_or_registration_number || '',
      kyc_status: tenantProfile.kyc_status || '',
      legal_emergency_contact_name: tenantProfile.emergency_contact_info?.name || '',
      legal_emergency_contact_phone: tenantProfile.emergency_contact_info?.phone || '',
    });
  }, [tenantProfile, form]);

  const handleFormSubmit = (values: TenantFormValues) => {
    setPendingData(values);
    setShowConfirmDialog(true);
  };

  const handleConfirm = async () => {
    if (!pendingData) return;
    setShowConfirmDialog(false);
    
    await onSubmit(pendingData);
    setPendingData(null);
  };

  const onSubmit = async (values: TenantFormValues) => {
    try {
      const userResponse = await supabase.auth.getUser();
      const userId = userResponse?.data?.user?.id || null;
      const existingSettings = (() => {
        try {
          return values.settings ? JSON.parse(values.settings) : (tenant?.settings || {});
        } catch {
          return tenant?.settings || {};
        }
      })();
      const nextSettings = {
        ...existingSettings,
        demographics: {
          age_group: values.demographics_age_group || existingSettings?.demographics?.age_group || '',
          gender: values.demographics_gender || existingSettings?.demographics?.gender || '',
          location: {
            country: values.demographics_location_country || existingSettings?.demographics?.location?.country || '',
            state: values.demographics_location_state || existingSettings?.demographics?.location?.state || '',
            city: values.demographics_location_city || existingSettings?.demographics?.location?.city || '',
          },
        },
        contacts: {
          primary: {
            name: values.contact_primary_name || existingSettings?.contacts?.primary?.name || '',
            email: values.contact_primary_email || existingSettings?.contacts?.primary?.email || '',
            phone: values.contact_primary_phone || existingSettings?.contacts?.primary?.phone || '',
          },
          secondary: {
            name: values.contact_secondary_name || existingSettings?.contacts?.secondary?.name || '',
            email: values.contact_secondary_email || existingSettings?.contacts?.secondary?.email || '',
            phone: values.contact_secondary_phone || existingSettings?.contacts?.secondary?.phone || '',
          },
          emergency: {
            name: values.contact_emergency_name || existingSettings?.contacts?.emergency?.name || '',
            phone: values.contact_emergency_phone || existingSettings?.contacts?.emergency?.phone || '',
          },
        },
        channels: {
          email: values.channels_email || existingSettings?.channels?.email || '',
          phone: values.channels_phone || existingSettings?.channels?.phone || '',
          social: {
            twitter: values.channels_twitter || existingSettings?.channels?.social?.twitter || '',
            linkedin: values.channels_linkedin || existingSettings?.channels?.social?.linkedin || '',
            facebook: values.channels_facebook || existingSettings?.channels?.social?.facebook || '',
          },
        },
        data_residency: {
          region: values.data_residency_region || existingSettings?.data_residency?.region || '',
          legal_basis: values.data_residency_legal_basis || existingSettings?.data_residency?.legal_basis || '',
          retention_policy: values.data_residency_retention_policy || existingSettings?.data_residency?.retention_policy || '',
          encryption_required: values.data_residency_encryption_required ?? existingSettings?.data_residency?.encryption_required ?? true,
        },
        support: {
          preferred_channel: values.support_preferred_channel || existingSettings?.support?.preferred_channel || '',
          escalation_level: values.support_escalation_level || existingSettings?.support?.escalation_level || '',
        },
      };

      const legalProfileComplete = Boolean(
        (values.legal_name || '').trim() &&
        (values.registered_address || '').trim() &&
        (values.default_payment_terms || '').trim()
      );
      const dataResidencyComplete = Boolean((values.data_residency_region || '').trim());
      const phase1Complete = legalProfileComplete && dataResidencyComplete;

      const onboardingStatus = phase1Complete ? 'submitted' : 'draft';
      const onboardingStep = phase1Complete ? 'plan_selection' : 'identity_legal';

      const onboardingFlags = {
        ...(nextSettings?.onboarding_flags || {}),
        identity_profile_completed: legalProfileComplete,
        data_residency_completed: dataResidencyComplete,
        phase1_completed: phase1Complete,
      };

      const dataResidencySettings = nextSettings?.data_residency || {};
      const supportSettings = nextSettings?.support || {};

      const data = {
        name: values.name,
        slug: values.slug,
        domain_id: values.domain_id,
        domain: values.domain || null,
        logo_url: values.logo_url || null,
        is_active: values.is_active,
        settings: {
          ...nextSettings,
          data_residency: dataResidencySettings,
          support: supportSettings,
          onboarding_flags: onboardingFlags,
        },
      };

      const profileData = {
        legal_name: values.legal_name || null,
        registered_address: values.registered_address || null,
        tax_id: values.tax_id || null,
        default_payment_terms: values.default_payment_terms || null,
        emergency_contact_info: {
          name: values.legal_emergency_contact_name || '',
          phone: values.legal_emergency_contact_phone || '',
        },
        tax_jurisdiction: values.tax_jurisdiction || null,
        tax_registration_type: values.tax_registration_type || null,
        gstin: values.gstin || null,
        vat_number: values.vat_number || null,
        cin_or_registration_number: values.cin_or_registration_number || null,
        kyc_status: values.kyc_status || null,
      };

      if (tenant) {
        const { error } = await scopedDb
          .from('tenants')
          .update(data)
          .eq('id', tenant.id);

        if (error) throw error;

        const { error: profileError } = await scopedDb
          .from('tenant_profile')
          .upsert(
            {
              tenant_id: tenant.id,
              ...profileData,
            },
            { onConflict: 'tenant_id' }
          );
        if (profileError) throw profileError;

        const { error: sessionError } = await scopedDb
          .from('tenant_onboarding_sessions')
          .upsert(
            {
              tenant_id: tenant.id,
              status: onboardingStatus,
              current_step: onboardingStep,
              started_by: userId,
              step_payloads: {
                phase1: {
                  legal_profile_completed: legalProfileComplete,
                  data_residency_completed: dataResidencyComplete,
                },
              },
              completed_at: phase1Complete ? new Date().toISOString() : null,
            },
            { onConflict: 'tenant_id' }
          );
        if (sessionError) throw sessionError;

        const { error: actErr } = await scopedDb
          .from('activities')
          .insert({
            activity_type: 'note',
            status: 'completed',
            priority: 'low',
            subject: 'Tenant onboarding phase 1 updated',
            description: `Core onboarding data updated for tenant ${data.name}`,
            tenant_id: tenant.id,
            franchise_id: null,
            account_id: null,
            contact_id: null,
            lead_id: null,
            created_by: userId,
          } as any);
        if (actErr) {
          console.warn('Activity logging failed:', actErr.message);
        }

        toast({
          title: 'Success',
          description: 'Tenant updated successfully',
        });
        onSuccess?.();
      } else {
        const { data: createdTenant, error } = await scopedDb
          .from('tenants')
          .insert(data)
          .select('id, name')
          .single();

        if (error) throw error;
        if (!createdTenant?.id) throw new Error('Tenant creation succeeded but tenant id is missing');

        const { error: profileError } = await scopedDb
          .from('tenant_profile')
          .upsert(
            {
              tenant_id: createdTenant.id,
              ...profileData,
            },
            { onConflict: 'tenant_id' }
          );
        if (profileError) throw profileError;

        const { error: sessionError } = await scopedDb
          .from('tenant_onboarding_sessions')
          .upsert(
            {
              tenant_id: createdTenant.id,
              status: onboardingStatus,
              current_step: onboardingStep,
              started_by: userId,
              step_payloads: {
                phase1: {
                  legal_profile_completed: legalProfileComplete,
                  data_residency_completed: dataResidencyComplete,
                },
              },
              completed_at: phase1Complete ? new Date().toISOString() : null,
            },
            { onConflict: 'tenant_id' }
          );
        if (sessionError) throw sessionError;

        const { error: actErr } = await scopedDb
          .from('activities')
          .insert({
            activity_type: 'note',
            status: 'completed',
            priority: 'low',
            subject: 'Tenant onboarding phase 1 created',
            description: `Core onboarding data created for tenant ${createdTenant.name}`,
            tenant_id: createdTenant.id,
            franchise_id: null,
            account_id: null,
            contact_id: null,
            lead_id: null,
            created_by: userId,
          } as any);
        if (actErr) {
          console.warn('Activity logging failed:', actErr.message);
        }

        toast({
          title: 'Success',
          description: 'Tenant created successfully',
        });
        navigate('/dashboard/tenants');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <Form {...form}>
        <CrudFormLayout
          title={tenant ? 'Edit Tenant' : 'New Tenant'}
          description="Organization profile, legal identity, residency controls, contacts, channels, and settings"
          onCancel={() => navigate('/dashboard/tenants')}
          onSave={() => form.handleSubmit(handleFormSubmit)()}
        >
          <FormStepper
            steps={[
              { id: 'details', label: 'Details' },
              { id: 'legal-tax', label: 'Legal & Tax' },
              { id: 'residency', label: 'Data Residency' },
              { id: 'demographics', label: 'Demographics' },
              { id: 'contacts', label: 'Contacts' },
              { id: 'channels', label: 'Channels' },
              { id: 'status', label: 'Status' },
            ]}
            activeId="details"
          />

          <div className="space-y-6">
            <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name *</FormLabel>
              <FormControl>
                <Input placeholder="Acme Corporation" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="domain_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Business Domain *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a domain" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {domains.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Slug *</FormLabel>
              <FormControl>
                <Input placeholder="acme-corp" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="domain"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Domain</FormLabel>
              <FormControl>
                <Input placeholder="acme.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="logo_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Logo URL</FormLabel>
              <FormControl>
                <Input placeholder="https://example.com/logo.png" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormSection title="Legal & Tax Identity">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="legal_name" render={({ field }) => (
              <FormItem>
                <FormLabel>Legal Name</FormLabel>
                <FormControl><Input placeholder="Acme Corporation Private Limited" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="default_payment_terms" render={({ field }) => (
              <FormItem>
                <FormLabel>Default Payment Terms</FormLabel>
                <FormControl><Input placeholder="Net 30" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="tax_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Tax ID</FormLabel>
                <FormControl><Input placeholder="Tax registration identifier" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="tax_jurisdiction" render={({ field }) => (
              <FormItem>
                <FormLabel>Tax Jurisdiction</FormLabel>
                <FormControl><Input placeholder="India / EU / US / Other" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="tax_registration_type" render={({ field }) => (
              <FormItem>
                <FormLabel>Tax Registration Type</FormLabel>
                <FormControl><Input placeholder="GST / VAT / EIN" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="kyc_status" render={({ field }) => (
              <FormItem>
                <FormLabel>KYC Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ''}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select KYC status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_review">In Review</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField control={form.control} name="gstin" render={({ field }) => (
              <FormItem>
                <FormLabel>GSTIN</FormLabel>
                <FormControl><Input placeholder="India GSTIN" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="vat_number" render={({ field }) => (
              <FormItem>
                <FormLabel>VAT Number</FormLabel>
                <FormControl><Input placeholder="EU / International VAT Number" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="cin_or_registration_number" render={({ field }) => (
              <FormItem>
                <FormLabel>CIN / Registration Number</FormLabel>
                <FormControl><Input placeholder="Company registration number" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
          <FormField control={form.control} name="registered_address" render={({ field }) => (
            <FormItem>
              <FormLabel>Registered Address</FormLabel>
              <FormControl>
                <Textarea placeholder="Registered legal address" rows={3} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="legal_emergency_contact_name" render={({ field }) => (
              <FormItem>
                <FormLabel>Compliance Emergency Contact Name</FormLabel>
                <FormControl><Input placeholder="Full name" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="legal_emergency_contact_phone" render={({ field }) => (
              <FormItem>
                <FormLabel>Compliance Emergency Contact Phone</FormLabel>
                <FormControl><Input placeholder="+1 555-0000" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </FormSection>
        <Separator />
        <FormSection title="Data Residency and Support">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField control={form.control} name="data_residency_region" render={({ field }) => (
              <FormItem>
                <FormLabel>Data Residency Region</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ''}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="india">India</SelectItem>
                    <SelectItem value="eu">EU</SelectItem>
                    <SelectItem value="us">US</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="data_residency_legal_basis" render={({ field }) => (
              <FormItem>
                <FormLabel>Legal Basis</FormLabel>
                <FormControl><Input placeholder="Contract / Consent / Legitimate interest" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="data_residency_retention_policy" render={({ field }) => (
              <FormItem>
                <FormLabel>Retention Policy</FormLabel>
                <FormControl><Input placeholder="e.g., 7 years" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="support_preferred_channel" render={({ field }) => (
              <FormItem>
                <FormLabel>Support Preferred Channel</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ''}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select support channel" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="portal">Portal</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="support_escalation_level" render={({ field }) => (
              <FormItem>
                <FormLabel>Support Escalation Level</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ''}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select escalation level" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="priority">Priority</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          </div>
          <FormField
            control={form.control}
            name="data_residency_encryption_required"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel>Encryption Required</FormLabel>
                  <div className="text-sm text-muted-foreground">
                    Require encrypted storage for tenant data
                  </div>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        </FormSection>
        <Separator />
        <FormSection title="Demographics">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={form.control} name="demographics_age_group" render={({ field }) => (
                <FormItem>
                  <FormLabel>Age Group</FormLabel>
                  <FormControl><Input placeholder="e.g., 25-34" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="demographics_gender" render={({ field }) => (
                <FormItem>
                  <FormLabel>Gender</FormLabel>
                  <FormControl><Input placeholder="e.g., Mixed" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="demographics_location_country" render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <FormControl><Input placeholder="e.g., USA" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={form.control} name="demographics_location_state" render={({ field }) => (
                <FormItem>
                  <FormLabel>State</FormLabel>
                  <FormControl><Input placeholder="e.g., California" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="demographics_location_city" render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl><Input placeholder="e.g., San Francisco" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
          </div>
        </FormSection>
        <Separator />
        <FormSection title="Primary Contacts">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={form.control} name="contact_primary_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Contact Name</FormLabel>
                  <FormControl><Input placeholder="Full name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="contact_primary_email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Contact Email</FormLabel>
                  <FormControl><Input placeholder="name@example.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="contact_primary_phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Contact Phone</FormLabel>
                  <FormControl><Input placeholder="+1 555-0000" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
          </div>
        </FormSection>
        <FormSection title="Secondary & Emergency Contacts">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={form.control} name="contact_secondary_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Secondary Contact Name</FormLabel>
                  <FormControl><Input placeholder="Full name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="contact_secondary_email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Secondary Contact Email</FormLabel>
                  <FormControl><Input placeholder="name@example.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="contact_secondary_phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Secondary Contact Phone</FormLabel>
                  <FormControl><Input placeholder="+1 555-0000" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="contact_emergency_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Emergency Contact Name</FormLabel>
                  <FormControl><Input placeholder="Full name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="contact_emergency_phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Emergency Contact Phone</FormLabel>
                  <FormControl><Input placeholder="+1 555-0000" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
          </div>
        </FormSection>
        <Separator />
        <FormSection title="Communication Channels">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="channels_email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Email Channel</FormLabel>
                  <FormControl><Input placeholder="support@example.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="channels_phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Phone Channel</FormLabel>
                  <FormControl><Input placeholder="+1 555-0000" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={form.control} name="channels_twitter" render={({ field }) => (
                <FormItem>
                  <FormLabel>Twitter</FormLabel>
                  <FormControl><Input placeholder="@handle" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="channels_linkedin" render={({ field }) => (
                <FormItem>
                  <FormLabel>LinkedIn</FormLabel>
                  <FormControl><Input placeholder="linkedin.com/company/..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="channels_facebook" render={({ field }) => (
                <FormItem>
                  <FormLabel>Facebook</FormLabel>
                  <FormControl><Input placeholder="facebook.com/..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
          </div>
        </FormSection>

        <FormField
          control={form.control}
          name="settings"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Settings (JSON)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder='{"key": "value"}' 
                  className="font-mono"
                  rows={4}
                  {...field} 
                />
              </FormControl>
              <FormDescription>Advanced: Raw JSON for additional custom settings</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormSection title="Status">
          <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel>Active Status</FormLabel>
                <div className="text-sm text-muted-foreground">
                  Enable or disable this tenant
                </div>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />
        </FormSection>
          </div>
        </CrudFormLayout>
      </Form>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm {tenant ? 'Update' : 'Create'}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {tenant ? 'update' : 'create'} this tenant?
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
