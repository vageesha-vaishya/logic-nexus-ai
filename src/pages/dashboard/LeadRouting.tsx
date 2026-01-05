import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, ArrowUpDown, Info, Users, List, PlayCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

interface AssignmentRule {
  id: string;
  rule_name: string;
  priority: number;
  criteria: any;
  assigned_to: string | null;
  assigned_queue_id: string | null;
  assignment_type: 'user' | 'queue' | 'round_robin_group';
  is_active: boolean;
}

export default function LeadRouting() {
  const navigate = useNavigate();
  const { supabase, context } = useCRM();
  const [rules, setRules] = useState<AssignmentRule[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [queues, setQueues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRule, setNewRule] = useState({
    rule_name: '',
    priority: 0,
    criteria_type: 'source',
    criteria_value: '',
    assigned_to: '',
    assigned_queue_id: '',
    assignment_type: 'user' as 'user' | 'queue' | 'round_robin_group',
    is_active: true,
  });

  useEffect(() => {
    fetchRules();
    fetchUsers();
    fetchQueues();
  }, []);

  const fetchRules = async () => {
    try {
      const { data, error } = await supabase
        .from('lead_assignment_rules')
        .select('*')
        .eq('tenant_id', context.tenantId)
        .order('priority', { ascending: false });

      if (error) throw error;
      setRules(data || []);
    } catch (error: any) {
      toast.error('Failed to load assignment rules');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email');

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchQueues = async () => {
    try {
      const { data, error } = await supabase
        .from('queues')
        .select('id, name, type');

      if (error) throw error;
      setQueues(data || []);
    } catch (error: any) {
      console.error('Error fetching queues:', error);
    }
  };

  const handleCreateRule = async () => {
    if (!newRule.rule_name) {
      toast.error('Rule name is required');
      return;
    }

    if (newRule.assignment_type === 'user' && !newRule.assigned_to) {
        toast.error('Please select a user');
        return;
    }

    if ((newRule.assignment_type === 'queue' || newRule.assignment_type === 'round_robin_group') && !newRule.assigned_queue_id) {
        toast.error('Please select a queue');
        return;
    }

    try {
      const { error } = await supabase
        .from('lead_assignment_rules')
        .insert({
          rule_name: newRule.rule_name,
          priority: newRule.priority,
          criteria: {
            type: newRule.criteria_type,
            value: newRule.criteria_value,
          },
          assigned_to: newRule.assignment_type === 'user' ? newRule.assigned_to : null,
          assigned_queue_id: newRule.assignment_type !== 'user' ? newRule.assigned_queue_id : null,
          assignment_type: newRule.assignment_type,
          is_active: newRule.is_active,
          tenant_id: context.tenantId,
        });

      if (error) throw error;

      toast.success('Assignment rule created successfully');
      setNewRule({
        rule_name: '',
        priority: 0,
        criteria_type: 'source',
        criteria_value: '',
        assigned_to: '',
        assigned_queue_id: '',
        assignment_type: 'user',
        is_active: true,
      });
      fetchRules();
    } catch (error: any) {
      toast.error('Failed to create assignment rule');
      console.error('Error:', error);
    }
  };

  const handleToggleRule = async (ruleId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('lead_assignment_rules')
        .update({ is_active: isActive })
        .eq('id', ruleId);

      if (error) throw error;

      toast.success(`Rule ${isActive ? 'activated' : 'deactivated'}`);
      fetchRules();
    } catch (error: any) {
      toast.error('Failed to update rule');
      console.error('Error:', error);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      const { error } = await supabase
        .from('lead_assignment_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;

      toast.success('Assignment rule deleted');
      fetchRules();
    } catch (error: any) {
      toast.error('Failed to delete rule');
      console.error('Error:', error);
    }
  };

  if (!context.isPlatformAdmin && !context.isTenantAdmin) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">You don't have permission to access this page</p>
        </div>
      </DashboardLayout>
    );
  }

  const getFilteredQueues = (type: 'holding' | 'round_robin') => {
      // In the select, we might want to show all queues if using generic queue assignment,
      // but ideally we filter by intended usage.
      // For simplicity, let's allow assigning to any queue, but maybe highlight type.
      // Actually, let's follow the requirement: 'holding' for queue assignment, 'round_robin' for group.
      return queues.filter(q => q.type === type);
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Lead Routing</h1>
          <p className="text-muted-foreground">Configure automatic lead assignment rules</p>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            You can manage Queues and Groups in the{' '}
            <Button
              variant="link"
              className="p-0 h-auto font-semibold"
              onClick={() => navigate('/dashboard/queues')}
            >
              Queue Management
            </Button>
            {' '}page.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Create Assignment Rule</CardTitle>
            <CardDescription>Automatically route leads to team members, queues, or groups</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ruleName">Rule Name *</Label>
                <Input
                  id="ruleName"
                  placeholder="e.g., Route referrals to Sales Queue"
                  value={newRule.rule_name}
                  onChange={(e) => setNewRule({ ...newRule, rule_name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Input
                  id="priority"
                  type="number"
                  placeholder="0"
                  value={newRule.priority}
                  onChange={(e) => setNewRule({ ...newRule, priority: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="criteriaType">Criteria Type</Label>
                <Select
                  value={newRule.criteria_type}
                  onValueChange={(value) => setNewRule({ ...newRule, criteria_type: value })}
                >
                  <SelectTrigger id="criteriaType">
                    <SelectValue placeholder="Select criteria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="source">Source</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                    <SelectItem value="estimated_value">Estimated Value</SelectItem>
                    <SelectItem value="location">Location</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="criteriaValue">Criteria Value</Label>
                <Input
                  id="criteriaValue"
                  placeholder="e.g., referral, website, etc."
                  value={newRule.criteria_value}
                  onChange={(e) => setNewRule({ ...newRule, criteria_value: e.target.value })}
                />
              </div>

              <div className="col-span-2">
                <Label className="mb-2 block">Assignment Target</Label>
                <Tabs 
                    value={newRule.assignment_type} 
                    onValueChange={(v) => setNewRule({ ...newRule, assignment_type: v as any, assigned_to: '', assigned_queue_id: '' })}
                >
                    <TabsList>
                        <TabsTrigger value="user">
                            <Users className="w-4 h-4 mr-2"/> User
                        </TabsTrigger>
                        <TabsTrigger value="queue">
                            <List className="w-4 h-4 mr-2"/> Queue
                        </TabsTrigger>
                        <TabsTrigger value="round_robin_group">
                            <PlayCircle className="w-4 h-4 mr-2"/> Round Robin Group
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="user" className="mt-4">
                        <Label htmlFor="assignedTo">Assign To User *</Label>
                        <Select
                            value={newRule.assigned_to}
                            onValueChange={(value) => setNewRule({ ...newRule, assigned_to: value })}
                        >
                            <SelectTrigger id="assignedTo">
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
                    </TabsContent>

                    <TabsContent value="queue" className="mt-4">
                        <Label htmlFor="assignedQueue">Assign To Queue *</Label>
                        <Select
                            value={newRule.assigned_queue_id}
                            onValueChange={(value) => setNewRule({ ...newRule, assigned_queue_id: value })}
                        >
                            <SelectTrigger id="assignedQueue">
                                <SelectValue placeholder="Select holding queue" />
                            </SelectTrigger>
                            <SelectContent>
                                {getFilteredQueues('holding').map((q) => (
                                    <SelectItem key={q.id} value={q.id}>
                                        {q.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </TabsContent>

                    <TabsContent value="round_robin_group" className="mt-4">
                        <Label htmlFor="assignedGroup">Assign To Round Robin Group *</Label>
                        <Select
                            value={newRule.assigned_queue_id}
                            onValueChange={(value) => setNewRule({ ...newRule, assigned_queue_id: value })}
                        >
                            <SelectTrigger id="assignedGroup">
                                <SelectValue placeholder="Select round robin group" />
                            </SelectTrigger>
                            <SelectContent>
                                {getFilteredQueues('round_robin').map((q) => (
                                    <SelectItem key={q.id} value={q.id}>
                                        {q.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </TabsContent>
                </Tabs>
              </div>

              <div className="space-y-2 flex items-end">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={newRule.is_active}
                    onCheckedChange={(checked) => setNewRule({ ...newRule, is_active: checked })}
                  />
                  <Label htmlFor="isActive">Active</Label>
                </div>
              </div>
            </div>

            <Button onClick={handleCreateRule}>
              <Plus className="mr-2 h-4 w-4" />
              Create Rule
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assignment Rules</CardTitle>
            <CardDescription>Manage your lead routing rules (ordered by priority)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading rules...</p>
              </div>
            ) : rules.length === 0 ? (
              <div className="text-center py-8">
                <ArrowUpDown className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No assignment rules configured yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rules.map((rule) => {
                  let assignmentText = 'Unknown';
                  if (rule.assignment_type === 'user' && rule.assigned_to) {
                      const u = users.find(u => u.id === rule.assigned_to);
                      assignmentText = u ? `User: ${u.first_name} ${u.last_name}` : 'Unknown User';
                  } else if (rule.assigned_queue_id) {
                      const q = queues.find(q => q.id === rule.assigned_queue_id);
                      const prefix = rule.assignment_type === 'round_robin_group' ? 'RR Group' : 'Queue';
                      assignmentText = q ? `${prefix}: ${q.name}` : `Unknown ${prefix}`;
                  }

                  return (
                    <div
                      key={rule.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{rule.rule_name}</span>
                          <span className="text-xs bg-muted px-2 py-1 rounded">
                            Priority: {rule.priority}
                          </span>
                          {!rule.is_active && (
                            <span className="text-xs bg-yellow-500/10 text-yellow-600 px-2 py-1 rounded">
                              Inactive
                            </span>
                          )}
                          <span className="text-xs bg-blue-500/10 text-blue-600 px-2 py-1 rounded capitalize">
                            {rule.assignment_type?.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          When {rule.criteria?.type} = "{rule.criteria?.value}" → Assign to{' '}
                          <span className="font-medium text-foreground">{assignmentText}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={(checked) => handleToggleRule(rule.id, checked)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteRule(rule.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How Lead Routing Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div>
              <p className="font-medium text-foreground mb-1">1. Lead Generation</p>
              <p>New leads are captured through web forms, imports, or manual entry</p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">2. Automatic Scoring</p>
              <p>Each lead receives an AI-powered score based on status, value, activity, and source</p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">3. Rule Matching</p>
              <p>Assignment rules are evaluated in priority order (highest first)</p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">4. Lead Assignment</p>
              <p>The first matching active rule assigns the lead to the specified Target (User, Queue, or Round Robin Group)</p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">5. Round Robin Distribution</p>
              <p>If assigned to a Round Robin Group, the system automatically picks the best available agent based on capacity.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
