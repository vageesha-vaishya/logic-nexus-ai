import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useTransportModes } from '@/hooks/useTransportModes';
import { useCRM } from '@/hooks/useCRM';
import { Plus, Pencil, Trash2, MoveUp, MoveDown } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

interface TransportModeForm {
  name: string;
  code: string;
  icon_name: string;
  color: string;
  display_order: number;
  is_active: boolean;
}

export default function TransportModes() {
  const { toast } = useToast();
  const { scopedDb, supabase } = useCRM();
  const { data: modes, refetch } = useTransportModes();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingMode, setEditingMode] = useState<any>(null);
  
  const [formData, setFormData] = useState<TransportModeForm>({
    name: '',
    code: '',
    icon_name: 'Package',
    color: 'hsl(var(--chart-1))',
    display_order: 1000,
    is_active: true
  });

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      icon_name: 'Package',
      color: 'hsl(var(--chart-1))',
      display_order: 1000,
      is_active: true
    });
  };

  const isUUID = (v: any) =>
    typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

  const isValidModeCode = (v: string) =>
    /^[a-z][a-z0-9_\-]{1,31}$/.test(v);

  const handleCreate = async () => {
    if (!formData.name || !formData.code || !formData.icon_name) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    const normalizedCode = String(formData.code).toLowerCase().trim();
    if (!isValidModeCode(normalizedCode)) {
      toast({
        title: 'Invalid Code',
        description: 'Code must start with a letter and contain only a-z, 0-9, _ or -',
        variant: 'destructive'
      });
      return;
    }
    if (modes?.some((m) => String(m.code).toLowerCase() === normalizedCode)) {
      toast({
        title: 'Duplicate Code',
        description: 'A transport mode with this code already exists',
        variant: 'destructive'
      });
      return;
    }
    if (!iconOptions.includes(formData.icon_name)) {
      toast({
        title: 'Invalid Icon',
        description: 'Please select a valid icon from the list',
        variant: 'destructive'
      });
      return;
    }

    const { error } = await scopedDb
      .from('transport_modes', true)
      .insert([{ ...formData, code: normalizedCode }]);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Success',
        description: 'Transport mode created successfully'
      });
      setIsCreateOpen(false);
      resetForm();
      refetch();
    }
  };

  const handleUpdate = async () => {
    if (!editingMode) return;

    const id = editingMode.id;
    if (!isUUID(id)) {
      toast({
        title: 'Invalid ID',
        description: 'Transport mode ID is not a valid UUID',
        variant: 'destructive'
      });
      return;
    }

    const normalizedCode = String(formData.code).toLowerCase().trim();
    if (!isValidModeCode(normalizedCode)) {
      toast({
        title: 'Invalid Code',
        description: 'Code must start with a letter and contain only a-z, 0-9, _ or -',
        variant: 'destructive'
      });
      return;
    }
    if (modes?.some((m) => m.id !== id && String(m.code).toLowerCase() === normalizedCode)) {
      toast({
        title: 'Duplicate Code',
        description: 'A transport mode with this code already exists',
        variant: 'destructive'
      });
      return;
    }
    if (!iconOptions.includes(formData.icon_name)) {
      toast({
        title: 'Invalid Icon',
        description: 'Please select a valid icon from the list',
        variant: 'destructive'
      });
      return;
    }

    const { error } = await supabase
      .from('transport_modes')
      .update({
        name: formData.name,
        code: normalizedCode,
        icon_name: formData.icon_name,
        color: formData.color,
        display_order: formData.display_order,
        is_active: formData.is_active
      })
      .eq('id', id);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Success',
        description: 'Transport mode updated successfully'
      });
      setIsEditOpen(false);
      setEditingMode(null);
      resetForm();
      refetch();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this transport mode?')) return;

    if (!isUUID(id)) {
      toast({
        title: 'Invalid ID',
        description: 'Transport mode ID is not a valid UUID',
        variant: 'destructive'
      });
      return;
    }

    const { error } = await scopedDb
      .from('transport_modes', true)
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Success',
        description: 'Transport mode deleted successfully'
      });
      refetch();
    }
  };

  const openEdit = (mode: any) => {
    setEditingMode(mode);
    setFormData({
      name: mode.name,
      code: mode.code,
      icon_name: mode.icon_name,
      color: mode.color,
      display_order: mode.display_order,
      is_active: mode.is_active
    });
    setIsEditOpen(true);
  };

  const updateDisplayOrder = async (id: string, direction: 'up' | 'down') => {
    if (!modes) return;
    
    if (!isUUID(id)) {
      toast({
        title: 'Invalid ID',
        description: 'Transport mode ID is not a valid UUID',
        variant: 'destructive'
      });
      return;
    }

    const currentMode = modes.find(m => m.id === id);
    if (!currentMode) return;

    const newOrder = direction === 'up' 
      ? currentMode.display_order - 150 
      : currentMode.display_order + 150;

    const { error } = await supabase
      .from('transport_modes')
      .update({ display_order: newOrder })
      .eq('id', id);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } else {
      refetch();
    }
  };

  // Common icon names for transport
  const iconOptions = [
    'Ship', 'Plane', 'Truck', 'Train', 'Package', 'Waves',
    'Container', 'Navigation', 'Anchor', 'Bus', 'Network'
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Transport Modes</h1>
          <p className="text-muted-foreground">
            Manage transport modes for multi-modal shipments
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Transport Modes</CardTitle>
                <CardDescription>
                  Configure available transport modes and their properties
                </CardDescription>
              </div>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Mode
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Icon</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modes?.map((mode) => {
                  const IconComponent = (LucideIcons as any)[mode.icon_name] || LucideIcons.Package;
                  return (
                    <TableRow key={mode.id}>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateDisplayOrder(mode.id, 'up')}
                          >
                            <MoveUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateDisplayOrder(mode.id, 'down')}
                          >
                            <MoveDown className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div 
                          className="p-2 rounded-full w-fit text-white"
                          style={{ backgroundColor: mode.color }}
                        >
                          <IconComponent className="h-4 w-4" />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{mode.name}</TableCell>
                      <TableCell className="font-mono text-sm">{mode.code}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-6 h-6 rounded border"
                            style={{ backgroundColor: mode.color }}
                          />
                          <span className="text-sm text-muted-foreground font-mono">
                            {mode.color}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={mode.is_active ? 'text-green-600' : 'text-muted-foreground'}>
                          {mode.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(mode)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(mode.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Transport Mode</DialogTitle>
              <DialogDescription>
                Add a new transport mode for your quotes
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Ocean Freight"
                />
              </div>
              <div>
                <Label>Code *</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., ocean"
                />
              </div>
              <div>
                <Label>Icon *</Label>
                <select
                  className="w-full border rounded-md p-2"
                  value={formData.icon_name}
                  onChange={(e) => setFormData({ ...formData, icon_name: e.target.value })}
                >
                  {iconOptions.map(icon => (
                    <option key={icon} value={icon}>{icon}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Color (HSL)</Label>
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="hsl(var(--chart-1))"
                />
              </div>
              <div>
                <Label>Display Order</Label>
                <Input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Transport Mode</DialogTitle>
              <DialogDescription>
                Update transport mode properties
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Code *</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                />
              </div>
              <div>
                <Label>Icon *</Label>
                <select
                  className="w-full border rounded-md p-2"
                  value={formData.icon_name}
                  onChange={(e) => setFormData({ ...formData, icon_name: e.target.value })}
                >
                  {iconOptions.map(icon => (
                    <option key={icon} value={icon}>{icon}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Color (HSL)</Label>
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                />
              </div>
              <div>
                <Label>Display Order</Label>
                <Input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdate}>Update</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
