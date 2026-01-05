import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, MapPin, Globe } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { TerritoryGeographyManager } from './TerritoryGeographyManager';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function TerritoryManagement() {
  const { supabase, context } = useCRM();
  const [territories, setTerritories] = useState<any[]>([]);
  const [geographyCounts, setGeographyCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTerritory, setSelectedTerritory] = useState<any>(null);
  
  // Platform admin support
  const [tenants, setTenants] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(context.tenantId || null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
  });

  // Effective tenant ID (context or selected)
  const effectiveTenantId = context.tenantId || selectedTenantId;

  useEffect(() => {
    if (context.isPlatformAdmin) {
      fetchTenants();
    }
  }, [context.isPlatformAdmin]);

  useEffect(() => {
    if (effectiveTenantId) {
      fetchTerritories();
    } else {
      setTerritories([]);
      setLoading(false);
    }
  }, [effectiveTenantId]);

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

  const fetchTerritories = async () => {
    if (!effectiveTenantId) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('territories')
        .select('*')
        .eq('tenant_id', effectiveTenantId);
        
      if (error) throw error;
      setTerritories(data || []);
      
      const ids = (data || []).map((t: any) => t.id);
      if (ids.length > 0) {
        const { data: geoRows, error: geoErr } = await supabase
          .from('territory_geographies')
          .select('id, territory_id')
          .in('territory_id', ids);
        if (geoErr) {
          setGeographyCounts({});
          const msg = (geoErr as any)?.message || '';
          const code = (geoErr as any)?.code || '';
          console.error('Failed to load geography counts:', { code, msg });
        } else {
          const counts: Record<string, number> = {};
          (geoRows || []).forEach((r: any) => {
            counts[r.territory_id] = (counts[r.territory_id] || 0) + 1;
          });
          setGeographyCounts(counts);
        }
      } else {
        setGeographyCounts({});
      }
    } catch (error: any) {
      toast.error('Failed to load territories');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (keepOpen: boolean = false) => {
    if (!formData.name.trim()) {
      toast.error('Territory name is required');
      return;
    }

    try {
      const basePayload = {
        name: formData.name,
        description: formData.description,
        is_active: formData.is_active,
        tenant_id: effectiveTenantId,
      };

      if (!basePayload.tenant_id) {
        throw new Error('Tenant context is missing. Please select a tenant.');
      }

      if (selectedTerritory) {
        const { data, error } = await supabase
          .from('territories')
          .update(basePayload)
          .eq('id', selectedTerritory.id);
        if (error) throw error;
        if (keepOpen) {
          setSelectedTerritory({ ...selectedTerritory, ...basePayload });
        }
      } else {
        const payload = {
          ...basePayload,
          criteria: {},
        };
        const { data, error } = await supabase
          .from('territories')
          .insert(payload)
          .select('id, name, description, is_active, tenant_id')
          .single();
        if (error) throw error;
        if (data) {
          setSelectedTerritory(data);
        }
      }

      toast.success(selectedTerritory ? 'Territory updated' : 'Territory created');
      if (!keepOpen) {
        setDialogOpen(false);
        setSelectedTerritory(null);
      } else {
        setDialogOpen(true);
      }
      fetchTerritories();
    } catch (error: any) {
      console.error('Error saving territory:', error);
      let errorMessage = 'Failed to save territory';
      
      // Handle specific Supabase/Postgres error codes
      if (error.code === '42501') {
        errorMessage = 'Permission denied. You do not have permission to manage territories.';
      } else if (error.code === '23505') {
        errorMessage = 'A territory with this name already exists.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      const errorDetails = error.details || '';
      toast.error(errorMessage, {
        description: errorDetails
      });
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

  if (loading && !effectiveTenantId && !context.isPlatformAdmin) {
    return <div className="text-center py-12">Loading territories...</div>;
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
          <h3 className="text-lg font-medium">Territories</h3>
          <p className="text-sm text-muted-foreground">
            Define geographic or business territories for lead assignment
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setSelectedTerritory(null)} disabled={!effectiveTenantId}>
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
                <Button onClick={() => handleSave(false)}>Save Details</Button>
                <Button onClick={() => handleSave(true)}>Save & Configure Geography</Button>
              </div>

              {selectedTerritory && (
                <div className="pt-6 border-t">
                  <h4 className="text-sm font-medium mb-4">Geographical Boundaries</h4>
                  <TerritoryGeographyManager territoryId={selectedTerritory.id} />
                </div>
              )}

              {!selectedTerritory && (
                <div className="pt-4 border-t text-center text-sm text-muted-foreground">
                  Save the territory to configure geographical boundaries
                </div>
              )}
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
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Globe className="h-4 w-4" />
                    <span>
                      {geographyCounts[territory.id] || 0} Geographies Defined
                    </span>
                  </div>
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
