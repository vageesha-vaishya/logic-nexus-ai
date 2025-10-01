import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, MapPin } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

export function TerritoryManagement() {
  const { supabase, context } = useCRM();
  const [territories, setTerritories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTerritory, setSelectedTerritory] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
  });

  useEffect(() => {
    fetchTerritories();
  }, []);

  useEffect(() => {
    if (selectedTerritory) {
      setFormData({
        name: selectedTerritory.name,
        description: selectedTerritory.description || '',
        is_active: selectedTerritory.is_active,
      });
    } else {
      setFormData({ name: '', description: '', is_active: true });
    }
  }, [selectedTerritory]);

  const fetchTerritories = async () => {
    try {
      let query = supabase.from('territories').select('*');
      if (context.tenantId) query = query.eq('tenant_id', context.tenantId);

      const { data, error } = await query;
      if (error) throw error;
      setTerritories(data || []);
    } catch (error: any) {
      toast.error('Failed to load territories');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const payload = {
        ...formData,
        tenant_id: context.tenantId,
      };

      if (selectedTerritory) {
        const { error } = await supabase
          .from('territories')
          .update(payload)
          .eq('id', selectedTerritory.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('territories').insert(payload);
        if (error) throw error;
      }

      toast.success(selectedTerritory ? 'Territory updated' : 'Territory created');
      setDialogOpen(false);
      setSelectedTerritory(null);
      fetchTerritories();
    } catch (error: any) {
      toast.error('Failed to save territory');
      console.error('Error:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this territory?')) return;

    try {
      const { error } = await supabase.from('territories').delete().eq('id', id);
      if (error) throw error;
      toast.success('Territory deleted');
      fetchTerritories();
    } catch (error: any) {
      toast.error('Failed to delete territory');
      console.error('Error:', error);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading territories...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Territories</h3>
          <p className="text-sm text-muted-foreground">
            Define geographic or business territories for lead assignment
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setSelectedTerritory(null)}>
              <Plus className="mr-2 h-4 w-4" />
              New Territory
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedTerritory ? 'Edit Territory' : 'Create Territory'}
              </DialogTitle>
              <DialogDescription>
                Configure territory details and boundaries
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Territory Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">Active</Label>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>Save</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {territories.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No territories configured</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create First Territory
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {territories.map((territory) => (
            <Card key={territory.id}>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      <h4 className="font-semibold">{territory.name}</h4>
                    </div>
                    <Badge variant={territory.is_active ? 'default' : 'secondary'}>
                      {territory.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  {territory.description && (
                    <p className="text-sm text-muted-foreground">{territory.description}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedTerritory(territory);
                        setDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(territory.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
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
