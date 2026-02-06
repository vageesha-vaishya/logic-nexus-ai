import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useCRM } from '@/hooks/useCRM';
import { MarginRule } from '@/services/pricing.service';
import { Plus, Trash2, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export function MarginRulesManager() {
  const { supabase, context } = useCRM();
  const [rules, setRules] = useState<MarginRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Rule State
  const [newRule, setNewRule] = useState<{
    name: string;
    adjustment_type: 'percent' | 'fixed';
    adjustment_value: string;
    priority: string;
    service_type: string;
  }>({
    name: '',
    adjustment_type: 'percent',
    adjustment_value: '0',
    priority: '0',
    service_type: ''
  });

  const fetchRules = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('margin_rules')
      .select('*')
      .order('priority', { ascending: false });

    if (error) {
      toast.error('Failed to load margin rules');
      console.error(error);
    } else {
      setRules(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRules();
  }, [supabase]);

  const handleAddRule = async () => {
    if (!newRule.name || !newRule.adjustment_value) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    
    // Construct condition_json based on simple service_type selection for now
    // In a real app, this would be a more complex condition builder
    const condition_json = newRule.service_type 
        ? { service_type: newRule.service_type } 
        : {};

    const payload = {
      name: newRule.name,
      adjustment_type: newRule.adjustment_type,
      adjustment_value: parseFloat(newRule.adjustment_value),
      priority: parseInt(newRule.priority) || 0,
      condition_json,
      tenant_id: context.tenantId // Ensure tenant isolation if RLS doesn't handle it automatically (it should)
    };

    const { error } = await supabase
      .from('margin_rules')
      .insert(payload);

    if (error) {
      toast.error('Failed to create rule: ' + error.message);
    } else {
      toast.success('Margin rule created successfully');
      setShowAddDialog(false);
      setNewRule({
        name: '',
        adjustment_type: 'percent',
        adjustment_value: '0',
        priority: '0',
        service_type: ''
      });
      fetchRules();
    }
    setIsSubmitting(false);
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    const { error } = await supabase
      .from('margin_rules')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete rule');
    } else {
      toast.success('Rule deleted');
      fetchRules();
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Margin Rules</CardTitle>
          <CardDescription>
            Define dynamic pricing rules for your quotes. Rules are applied in priority order.
          </CardDescription>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchRules} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> Add Rule
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                <DialogTitle>Add Margin Rule</DialogTitle>
                <DialogDescription>
                    Create a new rule to automatically adjust sell prices.
                </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Name</Label>
                    <Input 
                    value={newRule.name}
                    onChange={(e) => setNewRule({...newRule, name: e.target.value})}
                    className="col-span-3" 
                    placeholder="e.g. Air Freight Markup"
                    />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Type</Label>
                    <Select 
                        value={newRule.adjustment_type} 
                        onValueChange={(v: 'percent' | 'fixed') => setNewRule({...newRule, adjustment_type: v})}
                    >
                    <SelectTrigger className="col-span-3">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="percent">Percentage (%)</SelectItem>
                        <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                    </SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Value</Label>
                    <Input 
                    type="number"
                    value={newRule.adjustment_value}
                    onChange={(e) => setNewRule({...newRule, adjustment_value: e.target.value})}
                    className="col-span-3" 
                    />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Priority</Label>
                    <Input 
                    type="number"
                    value={newRule.priority}
                    onChange={(e) => setNewRule({...newRule, priority: e.target.value})}
                    className="col-span-3" 
                    placeholder="Higher runs first"
                    />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Service Type</Label>
                    <Input 
                    value={newRule.service_type}
                    onChange={(e) => setNewRule({...newRule, service_type: e.target.value})}
                    className="col-span-3" 
                    placeholder="Optional: e.g. air_freight"
                    />
                    <p className="text-xs text-muted-foreground col-start-2 col-span-3">
                        Leave empty to apply to all services, or match a service type key.
                    </p>
                </div>
                </div>
                <DialogFooter>
                <Button onClick={handleAddRule} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Rule
                </Button>
                </DialogFooter>
            </DialogContent>
            </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading && rules.length === 0 ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
            No margin rules defined.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Priority</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Adjustment</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>{rule.priority}</TableCell>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell>
                    {Object.keys(rule.condition_json).length === 0 ? (
                        <Badge variant="secondary">Global</Badge>
                    ) : (
                        <div className="flex flex-wrap gap-1">
                            {Object.entries(rule.condition_json).map(([k, v]) => (
                                <Badge key={k} variant="outline" className="text-xs">
                                    {k}: {String(v)}
                                </Badge>
                            ))}
                        </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={rule.adjustment_type === 'percent' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}>
                        {rule.adjustment_type === 'percent' ? '+' : ''}{rule.adjustment_value}
                        {rule.adjustment_type === 'percent' ? '%' : ''}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteRule(rule.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
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
