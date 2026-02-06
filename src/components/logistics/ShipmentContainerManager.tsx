import { useState, useEffect, useCallback } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Container, Trash2, Plus, AlertCircle, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

interface ShipmentContainerManagerProps {
  shipmentId: string;
  cargoConfigs: any[];
}

export function ShipmentContainerManager({ shipmentId, cargoConfigs }: ShipmentContainerManagerProps) {
  const { scopedDb, preferences, supabase } = useCRM();
  const [containers, setContainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Master Data
  const [containerTypes, setContainerTypes] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const [containerSizes, setContainerSizes] = useState<Array<{ id: string; name: string; iso_code?: string; type_id?: string }>>([]);

  // Load master data
  useEffect(() => {
    const loadRefs = async () => {
      try {
        const { data: types } = await supabase.from('container_types').select('id, name, code').order('name');
        setContainerTypes(types || []);
      } catch (err) {
        console.error('Failed to load container types', err);
      }
      try {
        const { data: sizes } = await supabase.from('container_sizes').select('id, name, iso_code, type_id').order('name');
        setContainerSizes(sizes || []);
      } catch (err) {
        console.error('Failed to load container sizes', err);
      }
    };
    loadRefs();
  }, [supabase]);
  
  // Form State
  const [formData, setFormData] = useState({
    container_number: '',
    seal_number: '',
    container_type_id: '',
    container_size_id: '',
    gross_weight_kg: '',
    volume_cbm: '',
    cargo_configuration_id: 'none',
    remarks: ''
  });

  const fetchContainers = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await scopedDb
        .from('shipment_containers' as any)
        .select(`
          *,
          container_types (name, code),
          container_sizes (name, iso_code)
        `)
        .eq('shipment_id', shipmentId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setContainers(data || []);
    } catch (error: any) {
      console.error('Error fetching containers:', error);
      toast.error('Failed to load containers');
    } finally {
      setLoading(false);
    }
  }, [shipmentId, scopedDb]);

  useEffect(() => {
    if (shipmentId) {
      fetchContainers();
    }
  }, [shipmentId, fetchContainers]);

  const handleConfigChange = (configId: string) => {
    if (configId === 'none') {
      setFormData(prev => ({ ...prev, cargo_configuration_id: 'none' }));
      return;
    }

    const config = cargoConfigs.find(c => c.id === configId);
    if (config) {
      setFormData(prev => ({
        ...prev,
        cargo_configuration_id: configId,
        container_type_id: config.container_type_id || prev.container_type_id,
        container_size_id: config.container_size_id || prev.container_size_id,
        // We could pre-fill other fields if we wanted, but usually actuals differ
      }));
    }
  };

  const handleSubmit = async () => {
    if (!formData.container_number) {
      toast.error('Container number is required');
      return;
    }

    try {
      setSaving(true);
      // Resolve text for backward compatibility or display if needed
      const typeObj = containerTypes.find(t => t.id === formData.container_type_id);
      const sizeObj = containerSizes.find(s => s.id === formData.container_size_id);
      
      const payload = {
        shipment_id: shipmentId,
        tenant_id: preferences?.tenant_id,
        container_number: formData.container_number,
        seal_number: formData.seal_number || null,
        // Store IDs
        container_type_id: formData.container_type_id || null,
        container_size_id: formData.container_size_id || null,
        // Also store text for legacy support/easier display in simple views
        container_type: typeObj ? typeObj.name : (formData.container_type_id || null),
        
        gross_weight_kg: formData.gross_weight_kg ? parseFloat(formData.gross_weight_kg) : null,
        volume_cbm: formData.volume_cbm ? parseFloat(formData.volume_cbm) : null,
        cargo_configuration_id: formData.cargo_configuration_id === 'none' ? null : formData.cargo_configuration_id,
        remarks: formData.remarks || null
      };

      const { error } = await scopedDb
        .from('shipment_containers' as any)
        .insert([payload]);

      if (error) throw error;

      toast.success('Container added successfully');
      setIsOpen(false);
      setFormData({
        container_number: '',
        seal_number: '',
        container_type_id: '',
        container_size_id: '',
        gross_weight_kg: '',
        volume_cbm: '',
        cargo_configuration_id: 'none',
        remarks: ''
      });
      fetchContainers();
    } catch (error: any) {
      console.error('Error saving container:', error);
      toast.error('Failed to save container: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this container?')) return;

    try {
      const { error } = await scopedDb
        .from('shipment_containers' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Container removed');
      fetchContainers();
    } catch (error: any) {
      toast.error('Failed to remove container');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Container className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Shipment Containers</CardTitle>
              <CardDescription>Manage actual containers and seals</CardDescription>
            </div>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" /> Add Container
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Container</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Container Number *</Label>
                    <Input 
                      value={formData.container_number} 
                      onChange={(e) => setFormData({...formData, container_number: e.target.value})}
                      placeholder="e.g. MSKU1234567"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Seal Number</Label>
                    <Input 
                      value={formData.seal_number} 
                      onChange={(e) => setFormData({...formData, seal_number: e.target.value})}
                      placeholder="e.g. 123456"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Links to Config (Optional)</Label>
                  <Select value={formData.cargo_configuration_id} onValueChange={handleConfigChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select equipment request..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None / Ad-hoc</SelectItem>
                      {cargoConfigs.map((config) => (
                        <SelectItem key={config.id} value={config.id}>
                          {config.container_type || config.cargo_type} {config.container_size && `(${config.container_size}')`} - {config.quantity} req
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Container Type</Label>
                    <Select 
                      value={formData.container_type_id} 
                      onValueChange={(val) => setFormData(prev => ({ ...prev, container_type_id: val }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Type" />
                      </SelectTrigger>
                      <SelectContent>
                        {containerTypes.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Container Size</Label>
                    <Select 
                      value={formData.container_size_id} 
                      onValueChange={(val) => setFormData(prev => ({ ...prev, container_size_id: val }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Size" />
                      </SelectTrigger>
                      <SelectContent>
                        {containerSizes
                          .filter(s => !formData.container_type_id || s.type_id === formData.container_type_id)
                          .map(s => {
                            const displayName = formData.container_type_id 
                              ? (s.name.match(/(\d+)/)?.[0] || s.name) 
                              : s.name;
                            return (
                              <SelectItem key={s.id} value={s.id}>{displayName}</SelectItem>
                            );
                          })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Gross Wt (kg)</Label>
                    <Input 
                      type="number"
                      value={formData.gross_weight_kg} 
                      onChange={(e) => setFormData({...formData, gross_weight_kg: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Volume (cbm)</Label>
                    <Input 
                      type="number"
                      value={formData.volume_cbm} 
                      onChange={(e) => setFormData({...formData, volume_cbm: e.target.value})}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Remarks</Label>
                  <Input 
                    value={formData.remarks} 
                    onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Container'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Container #</TableHead>
              <TableHead>Seal #</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Weights/Vol</TableHead>
              <TableHead>Linked Request</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {containers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No containers assigned yet.
                </TableCell>
              </TableRow>
            ) : (
              containers.map((container) => {
                const linkedConfig = cargoConfigs.find(c => c.id === container.cargo_configuration_id);
                return (
                  <TableRow key={container.id}>
                    <TableCell className="font-medium">{container.container_number}</TableCell>
                    <TableCell>{container.seal_number || '-'}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <Badge variant="outline">
                          {container.container_types?.name || container.container_type || '-'}
                        </Badge>
                        {container.container_sizes?.name && (
                          <span className="text-xs text-muted-foreground">
                            {(container.container_types?.name || container.container_type)
                              ? (container.container_sizes.name.match(/(\d+)/)?.[0] || container.container_sizes.name)
                              : container.container_sizes.name}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {container.gross_weight_kg && <div>G: {container.gross_weight_kg} kg</div>}
                      {container.volume_cbm && <div>V: {container.volume_cbm} cbm</div>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {linkedConfig ? (
                        <span>Linked to {linkedConfig.container_type}</span>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(container.id)} className="text-red-500 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
