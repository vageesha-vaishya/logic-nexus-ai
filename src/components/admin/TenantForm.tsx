import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { CrudFormLayout } from '@/components/system/CrudFormLayout';
import { FormSection } from '@/components/system/FormSection';
import { FormStepper } from '@/components/system/FormStepper';

const tenantSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  slug: z.string().min(2, 'Slug must be at least 2 characters').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  domain: z.string().optional(),
  logo_url: z.string().url().optional().or(z.literal('')),
  subscription_tier: z.string().optional(),
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
});

type TenantFormValues = z.infer<typeof tenantSchema>;

interface TenantFormProps {
  tenant?: any;
  onSuccess?: () => void;
}

export function TenantForm({ tenant, onSuccess }: TenantFormProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingData, setPendingData] = useState<TenantFormValues | null>(null);

  const form = useForm<TenantFormValues>({
    resolver: zodResolver(tenantSchema),
    defaultValues: {
      name: tenant?.name || '',
      slug: tenant?.slug || '',
      domain: tenant?.domain || '',
      logo_url: tenant?.logo_url || '',
      subscription_tier: tenant?.subscription_tier || '',
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
    },
  });

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
      };
      const data = {
        name: values.name,
        slug: values.slug,
        domain: values.domain || null,
        logo_url: values.logo_url || null,
        subscription_tier: values.subscription_tier || null,
        is_active: values.is_active,
        settings: nextSettings,
      };

      if (tenant) {
        const { error } = await supabase
          .from('tenants')
          .update(data)
          .eq('id', tenant.id);

        if (error) throw error;

        try {
          const user = await supabase.auth.getUser();
          const userId = user?.data?.user?.id || null;
          const { error: actErr } = await supabase
            .from('activities')
            .insert({
              activity_type: 'note',
              status: 'completed',
              priority: 'low',
              subject: 'Tenant settings updated',
              description: `Settings updated for tenant ${data.name}`,
              tenant_id: tenant.id,
              franchise_id: null,
              account_id: null,
              contact_id: null,
              lead_id: null,
              created_by: userId,
            } as any);
          if (actErr) {
            // ignore audit failure to not block update
          }
        } catch {
          // ignore audit exceptions
        }

        toast({
          title: 'Success',
          description: 'Tenant updated successfully',
        });
        onSuccess?.();
      } else {
        const { error } = await supabase
          .from('tenants')
          .insert([data]);

        if (error) throw error;

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
          description="Organization profile, contacts, channels, and settings"
          onCancel={() => navigate('/dashboard/tenants')}
          onSave={() => form.handleSubmit(handleFormSubmit)()}
        >
          <FormStepper
            steps={[
              { id: 'details', label: 'Details' },
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

        <FormField
          control={form.control}
          name="subscription_tier"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Subscription Tier</FormLabel>
              <FormControl>
                <Input placeholder="Enterprise" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
