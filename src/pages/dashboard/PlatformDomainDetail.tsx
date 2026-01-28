import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { CrudFormLayout } from '@/components/system/CrudFormLayout';
import { FormSection } from '@/components/system/FormSection';
import { DomainService, PlatformDomain } from '@/services/DomainService';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const domainSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  code: z.string().min(2, 'Code must be at least 2 characters').regex(/^[a-z0-9_]+$/, 'Code must be lowercase alphanumeric with underscores'),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
});

type DomainFormValues = z.infer<typeof domainSchema>;

export default function PlatformDomainDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isNew = !id || id === 'new';
  const [loading, setLoading] = useState(!isNew);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const form = useForm<DomainFormValues>({
    resolver: zodResolver(domainSchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
      is_active: true,
    },
  });

  useEffect(() => {
    if (!isNew && id) {
      loadDomain(id);
    }
  }, [id, isNew]);

  const loadDomain = async (domainId: string) => {
    try {
      const domains = await DomainService.getAllDomains(true);
      const domain = domains.find(d => d.id === domainId);
      
      if (!domain) {
        toast({ title: 'Error', description: 'Domain not found', variant: 'destructive' });
        navigate('/dashboard/settings/domains');
        return;
      }

      form.reset({
        name: domain.name,
        code: domain.code,
        description: domain.description || '',
        is_active: domain.is_active,
      });
    } catch (error) {
      console.error('Failed to load domain', error);
      toast({ title: 'Error', description: 'Failed to load domain details', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (values: DomainFormValues) => {
    try {
      if (isNew) {
        // Zod schema ensures values are strings, but we need to explicitly type them for createDomain
        await DomainService.createDomain({
          name: values.name,
          code: values.code,
          description: values.description,
          is_active: values.is_active
        });
        toast({ title: 'Success', description: 'Domain created successfully' });
      } else if (id) {
        await DomainService.updateDomain(id, values);
        toast({ title: 'Success', description: 'Domain updated successfully' });
      }
      navigate('/dashboard/settings/domains');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await DomainService.deleteDomain(id);
      toast({ title: 'Success', description: 'Domain deleted successfully' });
      navigate('/dashboard/settings/domains');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  if (loading) {
    return <DashboardLayout><div>Loading...</div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <CrudFormLayout
        title={isNew ? 'New Platform Domain' : 'Edit Platform Domain'}
        description={isNew ? 'Create a new business domain' : 'Update existing business domain details'}
        onSave={form.handleSubmit(onSubmit)}
        onCancel={() => navigate('/dashboard/settings/domains')}
        footerExtra={!isNew && (
          <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
            Delete
          </Button>
        )}
        saveDisabled={!form.formState.isValid || !form.formState.isDirty}
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormSection title="General Information" description="Basic details about the business domain">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Logistics & Freight" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. logistics" {...field} disabled={!isNew} />
                      </FormControl>
                      <FormDescription>Unique identifier used in system logic (cannot be changed later)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Describe the purpose of this domain..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Active Status</FormLabel>
                        <FormDescription>
                          Disable to hide this domain from new selections
                        </FormDescription>
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
              </div>
            </FormSection>
          </form>
        </Form>
      </CrudFormLayout>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the domain
              and potentially break any tenants referencing it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
