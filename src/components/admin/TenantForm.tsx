import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const tenantSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  slug: z.string().min(2, 'Slug must be at least 2 characters').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  domain: z.string().optional(),
  logo_url: z.string().url().optional().or(z.literal('')),
  subscription_tier: z.string().optional(),
  is_active: z.boolean().default(true),
  settings: z.string().optional(),
});

type TenantFormValues = z.infer<typeof tenantSchema>;

interface TenantFormProps {
  tenant?: any;
  onSuccess?: () => void;
}

export function TenantForm({ tenant, onSuccess }: TenantFormProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

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
    },
  });

  const onSubmit = async (values: TenantFormValues) => {
    try {
      const data = {
        name: values.name,
        slug: values.slug,
        domain: values.domain || null,
        logo_url: values.logo_url || null,
        subscription_tier: values.subscription_tier || null,
        is_active: values.is_active,
        settings: values.settings ? JSON.parse(values.settings) : null,
      };

      if (tenant) {
        const { error } = await supabase
          .from('tenants')
          .update(data)
          .eq('id', tenant.id);

        if (error) throw error;

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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
              <FormMessage />
            </FormItem>
          )}
        />

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

        <div className="flex gap-4">
          <Button type="submit" className="flex-1">
            {tenant ? 'Update' : 'Create'} Tenant
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/dashboard/tenants')}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
