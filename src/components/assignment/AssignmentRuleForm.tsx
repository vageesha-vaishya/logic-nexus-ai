import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

const ruleSchema = z.object({
  rule_name: z.string().min(1, 'Rule name is required'),
  assignment_type: z.enum(['round_robin', 'load_balance', 'territory', 'specific_user']),
  priority: z.number().min(0),
  assigned_to: z.string().optional(),
  territory_id: z.string().optional(),
  max_leads_per_user: z.number().min(1).optional(),
  criteria: z.record(z.any()).optional(),
});

type RuleFormData = z.infer<typeof ruleSchema>;

interface Props {
  rule?: any;
  tenantId?: string | null;
  onSave: () => void;
  onCancel: () => void;
}

export function AssignmentRuleForm({ rule, tenantId, onSave, onCancel }: Props) {
  const { supabase, context } = useCRM();
  const [users, setUsers] = useState<any[]>([]);
  const [territories, setTerritories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Effective tenant ID (prop or context)
  const effectiveTenantId = tenantId || context.tenantId;

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<RuleFormData>({
    resolver: zodResolver(ruleSchema),
    defaultValues: rule || {
      rule_name: '',
      assignment_type: 'round_robin',
      priority: 0,
      max_leads_per_user: 50,
    },
  });

  const assignmentType = watch('assignment_type');

  useEffect(() => {
    fetchUsers();
    fetchTerritories();
  }, []);

  const fetchUsers = async () => {
    // TODO: Verify if profiles table has tenant_id or if we need to filter differently
    const { data } = await scopedDb.from('profiles').select('id, first_name, last_name, email');
    setUsers(data || []);
  };

  const fetchTerritories = async () => {
    let query = scopedDb.from('territories').select('*').eq('is_active', true);
    if (effectiveTenantId) query = query.eq('tenant_id', effectiveTenantId);
    const { data } = await query;
    setTerritories(data || []);
  };

  const onSubmit = async (data: RuleFormData) => {
    setLoading(true);
    try {
      if (!effectiveTenantId) {
        throw new Error('Tenant context is missing');
      }

      const payload: any = {
        ...data,
        tenant_id: effectiveTenantId,
        is_active: true,
        criteria: data.criteria || {},
      };

      if (rule?.id) {
        const { error } = await scopedDb
          .from('lead_assignment_rules')
          .update(payload)
          .eq('id', rule.id);
        if (error) throw error;
      } else {
        const { error } = await scopedDb
          .from('lead_assignment_rules')
          .insert(payload);
        if (error) throw error;
      }

      toast.success(rule ? 'Rule updated' : 'Rule created');
      onSave();
    } catch (error: any) {
      toast.error('Failed to save rule');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="rule_name">Rule Name</Label>
        <Input id="rule_name" {...register('rule_name')} />
        {errors.rule_name && (
          <p className="text-sm text-destructive">{errors.rule_name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="assignment_type">Assignment Type</Label>
        <Select
          value={assignmentType}
          onValueChange={(value) => setValue('assignment_type', value as any)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="round_robin">Round Robin</SelectItem>
            <SelectItem value="load_balance">Load Balance</SelectItem>
            <SelectItem value="territory">Territory Based</SelectItem>
            <SelectItem value="specific_user">Specific User</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {assignmentType === 'specific_user' && (
        <div className="space-y-2">
          <Label htmlFor="assigned_to">Assign To User</Label>
          <Select
            value={watch('assigned_to') || ''}
            onValueChange={(value) => setValue('assigned_to', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select user" />
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.first_name} {user.last_name} ({user.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {assignmentType === 'territory' && (
        <div className="space-y-2">
          <Label htmlFor="territory_id">Territory</Label>
          <Select
            value={watch('territory_id') || ''}
            onValueChange={(value) => setValue('territory_id', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select territory" />
            </SelectTrigger>
            <SelectContent>
              {territories.map((territory) => (
                <SelectItem key={territory.id} value={territory.id}>
                  {territory.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="priority">Priority</Label>
        <Input
          id="priority"
          type="number"
          {...register('priority', { valueAsNumber: true })}
        />
        <p className="text-xs text-muted-foreground">
          Higher priority rules are evaluated first
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="max_leads_per_user">Max Leads Per User</Label>
        <Input
          id="max_leads_per_user"
          type="number"
          {...register('max_leads_per_user', { valueAsNumber: true })}
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : rule ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  );
}
