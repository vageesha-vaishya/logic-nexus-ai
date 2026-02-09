import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, MoreHorizontal, Trash2, Edit, ArrowUp, ArrowDown, Filter, Zap } from 'lucide-react';
import { useQueueManagement, Queue, QueueRule, QueueRuleCriteria } from '@/hooks/useQueueManagement';

interface RuleFormData {
  name: string;
  description: string;
  queue_id: string;
  priority: number;
  is_active: boolean;
  criteria: QueueRuleCriteria;
}

const initialFormData: RuleFormData = {
  name: '',
  description: '',
  queue_id: '',
  priority: 0,
  is_active: true,
  criteria: {},
};

export function QueueRulesManager() {
  const { queues, rules, rulesLoading, createRule, updateRule, deleteRule, getTenantId } = useQueueManagement();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<QueueRule | null>(null);
  const [formData, setFormData] = useState<RuleFormData>(initialFormData);

  const handleOpenCreate = () => {
    setEditingRule(null);
    setFormData(initialFormData);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (rule: QueueRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      queue_id: rule.queue_id,
      priority: rule.priority,
      is_active: rule.is_active,
      criteria: rule.criteria,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    const tenantId = getTenantId();
    if (!tenantId) return;

    if (editingRule) {
      await updateRule(editingRule.id, {
        name: formData.name,
        description: formData.description || null,
        queue_id: formData.queue_id,
        priority: formData.priority,
        is_active: formData.is_active,
        criteria: formData.criteria,
      });
    } else {
      await createRule({
        tenant_id: tenantId,
        queue_id: formData.queue_id,
        name: formData.name,
        description: formData.description || null,
        priority: formData.priority,
        is_active: formData.is_active,
        criteria: formData.criteria,
      });
    }

    setIsDialogOpen(false);
    setFormData(initialFormData);
    setEditingRule(null);
  };

  const handleDelete = async (ruleId: string) => {
    if (confirm('Are you sure you want to delete this rule?')) {
      await deleteRule(ruleId);
    }
  };

  const handleToggleActive = async (rule: QueueRule) => {
    await updateRule(rule.id, { is_active: !rule.is_active });
  };

  const updateCriteria = (key: keyof QueueRuleCriteria, value: any) => {
    setFormData((prev) => ({
      ...prev,
      criteria: {
        ...prev.criteria,
        [key]: value || undefined,
      },
    }));
  };

  const addHeaderRule = () => {
    const currentHeaders = formData.criteria.header_contains || {};
    updateCriteria('header_contains', { ...currentHeaders, '': '' });
  };

  const updateHeaderRule = (oldKey: string, newKey: string, newValue: string) => {
    const currentHeaders = { ...(formData.criteria.header_contains || {}) };
    if (oldKey !== newKey) {
      delete currentHeaders[oldKey];
    }
    currentHeaders[newKey] = newValue;
    updateCriteria('header_contains', currentHeaders);
  };

  const removeHeaderRule = (key: string) => {
    const currentHeaders = { ...(formData.criteria.header_contains || {}) };
    delete currentHeaders[key];
    updateCriteria('header_contains', Object.keys(currentHeaders).length > 0 ? currentHeaders : undefined);
  };

  const getCriteriaDisplay = (criteria: QueueRuleCriteria) => {
    const parts: string[] = [];
    if (criteria.subject_contains) parts.push(`Subject: "${criteria.subject_contains}"`);
    if (criteria.from_email) parts.push(`From: ${criteria.from_email}`);
    if (criteria.from_domain) parts.push(`Domain: @${criteria.from_domain}`);
    if (criteria.body_contains) parts.push(`Body: "${criteria.body_contains}"`);
    if (criteria.header_contains) {
      const headers = Object.entries(criteria.header_contains)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      parts.push(`Headers: [${headers}]`);
    }
    if (criteria.metadata_flags && criteria.metadata_flags.length > 0) {
      parts.push(`Flags: [${criteria.metadata_flags.join(', ')}]`);
    }
    if (criteria.priority) parts.push(`Priority: ${criteria.priority}`);
    if (criteria.ai_category) parts.push(`Category: ${criteria.ai_category}`);
    if (criteria.ai_sentiment) parts.push(`Sentiment: ${criteria.ai_sentiment}`);
    return parts.length > 0 ? parts.join(', ') : 'No criteria';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Queue Rules
          </CardTitle>
          <CardDescription>
            Define rules to automatically categorize incoming emails into queues
          </CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingRule ? 'Edit Rule' : 'Create New Rule'}</DialogTitle>
              <DialogDescription>
                Define criteria to automatically assign emails to queues
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Rule Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., VIP Customer Emails"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="queue">Target Queue</Label>
                  <Select
                    value={formData.queue_id}
                    onValueChange={(v) => setFormData((prev) => ({ ...prev, queue_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select queue" />
                    </SelectTrigger>
                    <SelectContent>
                      {queues.map((q) => (
                        <SelectItem key={q.queue_id} value={q.queue_id}>
                          {q.queue_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description for this rule"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority (higher = first)</Label>
                  <Input
                    id="priority"
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData((prev) => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className="flex items-center space-x-2 pt-6">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(c) => setFormData((prev) => ({ ...prev, is_active: c }))}
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Matching Criteria
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Subject Contains</Label>
                    <Input
                      value={formData.criteria.subject_contains || ''}
                      onChange={(e) => updateCriteria('subject_contains', e.target.value)}
                      placeholder="e.g., Urgent"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>From Email (exact)</Label>
                    <Input
                      value={formData.criteria.from_email || ''}
                      onChange={(e) => updateCriteria('from_email', e.target.value)}
                      placeholder="e.g., vip@client.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>From Domain</Label>
                    <Input
                      value={formData.criteria.from_domain || ''}
                      onChange={(e) => updateCriteria('from_domain', e.target.value)}
                      placeholder="e.g., vip.example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Body Contains</Label>
                    <Input
                      value={formData.criteria.body_contains || ''}
                      onChange={(e) => updateCriteria('body_contains', e.target.value)}
                      placeholder="e.g., feedback"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>AI Category</Label>
                    <Select
                      value={formData.criteria.ai_category || ''}
                      onValueChange={(v) => updateCriteria('ai_category', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Any</SelectItem>
                        <SelectItem value="sales">Sales</SelectItem>
                        <SelectItem value="support">Support</SelectItem>
                        <SelectItem value="feedback">Feedback</SelectItem>
                        <SelectItem value="inquiry">Inquiry</SelectItem>
                        <SelectItem value="complaint">Complaint</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>AI Sentiment</Label>
                    <Select
                      value={formData.criteria.ai_sentiment || ''}
                      onValueChange={(v) => updateCriteria('ai_sentiment', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Any</SelectItem>
                        <SelectItem value="positive">Positive</SelectItem>
                        <SelectItem value="neutral">Neutral</SelectItem>
                        <SelectItem value="negative">Negative</SelectItem>
                        <SelectItem value="very_negative">Very Negative</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-4 space-y-4 border-t pt-4">
                  <h5 className="text-sm font-medium text-muted-foreground">Advanced Context Routing</h5>
                  
                  {/* Header Rules */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Header Checks (e.g., X-Priority, X-Spam-Score)</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addHeaderRule}>
                        <Plus className="h-3 w-3 mr-1" /> Add Header
                      </Button>
                    </div>
                    {formData.criteria.header_contains && Object.entries(formData.criteria.header_contains).map(([key, value], index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input 
                          placeholder="Header Name" 
                          value={key} 
                          onChange={(e) => updateHeaderRule(key, e.target.value, value)}
                          className="flex-1"
                        />
                        <span className="text-muted-foreground">=</span>
                        <Input 
                          placeholder="Value Contains" 
                          value={value} 
                          onChange={(e) => updateHeaderRule(key, key, e.target.value)}
                          className="flex-1"
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeHeaderRule(key)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                    {(!formData.criteria.header_contains || Object.keys(formData.criteria.header_contains).length === 0) && (
                      <div className="text-xs text-muted-foreground italic">No header rules defined</div>
                    )}
                  </div>

                  {/* Metadata Flags */}
                  <div className="space-y-2">
                    <Label>Metadata Flags (comma separated)</Label>
                    <Input
                      value={formData.criteria.metadata_flags?.join(', ') || ''}
                      onChange={(e) => updateCriteria('metadata_flags', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                      placeholder="e.g., urgent, vip-client, campaign-x"
                    />
                    <p className="text-xs text-muted-foreground">
                      Checks if the email metadata contains these specific flag keys
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!formData.name || !formData.queue_id}>
                {editingRule ? 'Update Rule' : 'Create Rule'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {rulesLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading rules...</div>
        ) : rules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Filter className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No queue rules defined yet</p>
            <p className="text-sm">Create a rule to automatically categorize incoming emails</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Queue</TableHead>
                <TableHead>Criteria</TableHead>
                <TableHead className="w-20 text-center">Priority</TableHead>
                <TableHead className="w-20 text-center">Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id} className={!rule.is_active ? 'opacity-50' : ''}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{rule.name}</div>
                      {rule.description && (
                        <div className="text-xs text-muted-foreground">{rule.description}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{rule.queue?.name || 'Unknown'}</Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                    {getCriteriaDisplay(rule.criteria)}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <ArrowUp className="h-3 w-3 text-muted-foreground" />
                      {rule.priority}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={() => handleToggleActive(rule)}
                      aria-label="Toggle active"
                    />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenEdit(rule)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(rule.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
