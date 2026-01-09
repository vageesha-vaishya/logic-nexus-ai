import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { AssignmentRuleForm } from './AssignmentRuleForm';

interface AssignmentRule {
  id: string;
  rule_name: string;
  assignment_type: string;
  priority: number;
  is_active: boolean;
  criteria: any;
  assigned_to: string | null;
  territory_id: string | null;
  max_leads_per_user: number | null;
}

interface Props {
  onUpdate?: () => void;
}

export function AssignmentRules({ onUpdate }: Props) {
  const { supabase, context } = useCRM();
  const [rules, setRules] = useState<AssignmentRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRule, setSelectedRule] = useState<AssignmentRule | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Platform admin support
  const [tenants, setTenants] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(context.tenantId || null);

  // Effective tenant ID (context or selected)
  const effectiveTenantId = context.tenantId || selectedTenantId;

  useEffect(() => {
    if (context.isPlatformAdmin) {
      fetchTenants();
    }
  }, [context.isPlatformAdmin]);

  useEffect(() => {
    if (effectiveTenantId) {
      fetchRules();
    } else {
      setRules([]);
      setLoading(false);
    }
  }, [effectiveTenantId]);

  const fetchTenants = async () => {
    try {
      const { data, error } = await supabase.from('tenants').select('id, name').order('name');
      if (error) throw error;
      setTenants(data || []);
      
      // Auto-select first tenant if none selected and tenants exist
      if (data && data.length > 0 && !selectedTenantId) {
        setSelectedTenantId(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
      toast.error('Failed to load tenants');
    }
  };

  const fetchRules = async () => {
    if (!effectiveTenantId) return;

    try {
      const query = supabase
        .from('lead_assignment_rules')
        .select('*')
        .eq('tenant_id', effectiveTenantId)
        .order('priority', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      setRules(data || []);
    } catch (error: any) {
      toast.error('Failed to load rules');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (ruleId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('lead_assignment_rules')
        .update({ is_active: !isActive })
        .eq('id', ruleId);

      if (error) throw error;
      toast.success('Rule updated');
      fetchRules();
      onUpdate?.();
    } catch (error: any) {
      toast.error('Failed to update rule');
      console.error('Error:', error);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      const { error } = await supabase
        .from('lead_assignment_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;
      toast.success('Rule deleted');
      fetchRules();
      onUpdate?.();
    } catch (error: any) {
      toast.error('Failed to delete rule');
      console.error('Error:', error);
    }
  };

  const handlePriorityChange = async (ruleId: string, direction: 'up' | 'down') => {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;

    const newPriority = direction === 'up' ? rule.priority + 1 : rule.priority - 1;

    try {
      const { error } = await supabase
        .from('lead_assignment_rules')
        .update({ priority: newPriority })
        .eq('id', ruleId);

      if (error) throw error;
      fetchRules();
      onUpdate?.();
    } catch (error: any) {
      toast.error('Failed to update priority');
      console.error('Error:', error);
    }
  };

  const handleSave = () => {
    setDialogOpen(false);
    setSelectedRule(null);
    fetchRules();
    onUpdate?.();
  };

  const getAssignmentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      round_robin: 'Round Robin',
      load_balance: 'Load Balance',
      territory: 'Territory Based',
      specific_user: 'Specific User',
    };
    return labels[type] || type;
  };

  if (loading) {
    return <div className="text-center py-12">Loading rules...</div>;
  }

  return (
    <div className="space-y-4">
      {context.isPlatformAdmin && (
        <Card className="mb-4">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <Label>Select Tenant Context:</Label>
              <Select
                value={selectedTenantId || ''}
                onValueChange={setSelectedTenantId}
              >
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="Select a tenant" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Assignment Rules</h3>
          <p className="text-sm text-muted-foreground">
            Configure automated lead assignment workflows
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setSelectedRule(null)}>
              <Plus className="mr-2 h-4 w-4" />
              New Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedRule ? 'Edit Assignment Rule' : 'Create Assignment Rule'}
              </DialogTitle>
              <DialogDescription>
                Define how leads should be automatically assigned to users
              </DialogDescription>
            </DialogHeader>
            <AssignmentRuleForm
              rule={selectedRule}
              onSave={handleSave}
              onCancel={() => {
                setDialogOpen(false);
                setSelectedRule(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {rules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No assignment rules configured</p>
            <Button onClick={() => setDialogOpen(true)} disabled={!effectiveTenantId}>
              <Plus className="mr-2 h-4 w-4" />
              Create First Rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Card key={rule.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handlePriorityChange(rule.id, 'up')}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handlePriorityChange(rule.id, 'down')}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{rule.rule_name}</h4>
                        <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                          {rule.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Badge variant="outline">
                          {getAssignmentTypeLabel(rule.assignment_type)}
                        </Badge>
                        <Badge variant="outline">Priority: {rule.priority}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {rule.criteria && Object.keys(rule.criteria).length > 0
                          ? `Criteria: ${Object.entries(rule.criteria)
                              .map(([k, v]) => `${k}=${v}`)
                              .join(', ')}`
                          : 'No criteria defined'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={() => handleToggleActive(rule.id, rule.is_active)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedRule(rule);
                        setDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(rule.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
