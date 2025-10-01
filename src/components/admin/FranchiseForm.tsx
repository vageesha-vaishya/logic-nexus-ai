import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCRM } from '@/hooks/useCRM';

const franchiseSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  code: z.string().min(2, 'Code must be at least 2 characters'),
  tenant_id: z.string().min(1, 'Tenant is required'),
  manager_id: z.string().optional(),
  is_active: z.boolean().default(true),
  address: z.string().optional(),
});

type FranchiseFormValues = z.infer<typeof franchiseSchema>;

interface FranchiseFormProps {
  franchise?: any;
  onSuccess?: () => void;
}

export function FranchiseForm({ franchise, onSuccess }: FranchiseFormProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { context } = useCRM();
  const [tenants, setTenants] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);

  const form = useForm<FranchiseFormValues>({
    resolver: zodResolver(franchiseSchema),
    defaultValues: {
      name: franchise?.name || '',
      code: franchise?.code || '',
      tenant_id: franchise?.tenant_id || context.tenantId || '',
      manager_id: franchise?.manager_id || '',
      is_active: franchise?.is_active ?? true,
      address: franchise?.address ? JSON.stringify(franchise.address, null, 2) : '',
    },
  });

  useEffect(() => {
    fetchTenants();
    fetchManagers();
  }, []);

  const fetchTenants = async () => {
    const { data } = await supabase.from('tenants').select('id, name').eq('is_active', true);
    setTenants(data || []);
  };

  const fetchManagers = async () => {
    const { data } = await supabase.from('profiles').select('id, first_name, last_name, email');
    setManagers(data || []);
  };

  const onSubmit = async (values: FranchiseFormValues) => {
    try {
      const data = {
        name: values.name,
        code: values.code,
        tenant_id: values.tenant_id,
        manager_id: values.manager_id || null,
        is_active: values.is_active,
        address: values.address ? JSON.parse(values.address) : null,
      };

      if (franchise) {
        const { error } = await supabase
          .from('franchises')
          .update(data)
          .eq('id', franchise.id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Franchise updated successfully',
        });
        onSuccess?.();
      } else {
        const { error } = await supabase
          .from('franchises')
          .insert([data]);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Franchise created successfully',
        });
        navigate('/dashboard/franchises');
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
                <Input placeholder="Downtown Branch" {...field} />
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
                <Input placeholder="DT-001" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="tenant_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tenant *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
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

        <FormField
          control={form.control}
          name="manager_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Manager</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select manager" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {managers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {manager.first_name} {manager.last_name} ({manager.email})
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
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address (JSON)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder='{"street": "123 Main St", "city": "New York", "state": "NY", "zip": "10001"}' 
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
                  Enable or disable this franchise
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
            {franchise ? 'Update' : 'Create'} Franchise
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/dashboard/franchises')}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
