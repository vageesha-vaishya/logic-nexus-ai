import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PortLocationForm } from '@/components/logistics/PortLocationForm';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { seedPortsForTenant } from '@/integrations/supabase/seedPortsLocations';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function PortsLocations() {
  const navigate = useNavigate();
  const { supabase, context } = useCRM();
  const { roles } = useAuth();
  const [ports, setPorts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | undefined>(undefined);
  const [filterName, setFilterName] = useState('');
  const [filterCode, setFilterCode] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'seaport' | 'airport' | 'inland_port' | 'warehouse' | 'terminal'>('all');
  const [filterCity, setFilterCity] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterCustoms, setFilterCustoms] = useState<'all' | 'yes' | 'no'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    if (context.isPlatformAdmin || context.tenantId || roles?.[0]?.tenant_id) {
      fetchPorts();
    } else {
      setLoading(false);
    }
  }, [context.isPlatformAdmin, context.tenantId, roles]);

  const fetchPorts = async () => {
    const tenantId = context.tenantId || roles?.[0]?.tenant_id;
    const isPlatform = context.isPlatformAdmin;
    if (!isPlatform && !tenantId) {
      setLoading(false);
      return;
    }

    try {
      let query = supabase
        .from('ports_locations')
        .select('*');
      if (!isPlatform) {
        query = query.eq('tenant_id', tenantId as string);
      }
      const { data, error } = await query.order('location_name');

      if (error) throw error;
      const rows = data || [];
      // Dev-only: auto-seed demo ports/locations if none exist (only when tenant scoped)
      if (!isPlatform && rows.length === 0 && import.meta.env.DEV) {
        try {
          const count = await seedPortsForTenant(supabase, tenantId as string);
          if (count > 0) toast.success(`Seeded ${count} demo ports/locations`);
          const { data: seeded } = await supabase
            .from('ports_locations')
            .select('*')
            .eq('tenant_id', tenantId as string)
            .order('location_name');
          setPorts(seeded || []);
        } catch (seedErr: any) {
          console.warn('Ports/locations seed failed:', seedErr?.message || seedErr);
          setPorts([]);
        }
      } else {
        setPorts(rows);
      }
    } catch (error: any) {
      toast.error('Failed to load ports/locations', {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    setDialogOpen(false);
    fetchPorts();
  };

  const handleEditSuccess = () => {
    setEditDialogOpen(false);
    setEditingLocationId(undefined);
    fetchPorts();
  };

  const onEdit = (id: string) => {
    setEditingLocationId(id);
    setEditDialogOpen(true);
  };

  const onDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('ports_locations').delete().eq('id', id);
      if (error) throw error;
      toast.success('Port/Location deleted');
      fetchPorts();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete port/location');
    }
  };

  const filteredPorts = ports.filter((p) => {
    const nameMatch = !filterName || (p.location_name || '').toLowerCase().includes(filterName.toLowerCase());
    const codeMatch = !filterCode || (p.location_code || '').toLowerCase().includes(filterCode.toLowerCase());
    const typeMatch = filterType === 'all' || p.location_type === filterType;
    const cityMatch = !filterCity || (p.city || '').toLowerCase().includes(filterCity.toLowerCase());
    const countryMatch = !filterCountry || (p.country || '').toLowerCase().includes(filterCountry.toLowerCase());
    const customsMatch = filterCustoms === 'all' || (filterCustoms === 'yes' ? !!p.customs_available : !p.customs_available);
    const statusMatch = filterStatus === 'all' || (filterStatus === 'active' ? !!p.is_active : !p.is_active);
    return nameMatch && codeMatch && typeMatch && cityMatch && countryMatch && customsMatch && statusMatch;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Ports & Locations</h1>
            <p className="text-muted-foreground">Manage shipping ports, airports, and facilities</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Port/Location
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Port/Location</DialogTitle>
              </DialogHeader>
              <PortLocationForm onSuccess={handleSuccess} />
            </DialogContent>
          </Dialog>
          {import.meta.env.DEV && (context.tenantId || roles?.[0]?.tenant_id) && (
            <Button
              variant="outline"
              onClick={async () => {
                const tenantId = context.tenantId || roles?.[0]?.tenant_id;
                const count = await seedPortsForTenant(supabase, tenantId as string);
                if (count > 0) fetchPorts();
              }}
            >Seed Demo Ports</Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Ports & Locations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-6 gap-3 mb-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Name</label>
                <Input placeholder="Search name" value={filterName} onChange={(e) => setFilterName(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Code</label>
                <Input placeholder="Search code" value={filterCode} onChange={(e) => setFilterCode(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">City</label>
                <Input placeholder="Search city" value={filterCity} onChange={(e) => setFilterCity(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Country</label>
                <Input placeholder="Search country" value={filterCountry} onChange={(e) => setFilterCountry(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Type</label>
                <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="seaport">Seaport</SelectItem>
                    <SelectItem value="airport">Airport</SelectItem>
                    <SelectItem value="inland_port">Inland Port</SelectItem>
                    <SelectItem value="warehouse">Warehouse</SelectItem>
                    <SelectItem value="terminal">Terminal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Customs</label>
                <Select value={filterCustoms} onValueChange={(v) => setFilterCustoms(v as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="yes">Available</SelectItem>
                    <SelectItem value="no">Not Available</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Status</label>
                <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading ports/locations...</div>
            ) : filteredPorts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No ports/locations found. Create your first port/location to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Location Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Customs</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPorts.map((port) => (
                    <TableRow key={port.id}>
                      <TableCell className="font-medium">{port.location_name}</TableCell>
                      <TableCell>{port.location_code || 'N/A'}</TableCell>
                      <TableCell>
                        {port.location_type && (
                          <Badge variant="outline">
                            {port.location_type.replace('_', ' ').toUpperCase()}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {port.city && port.country ? (
                            <div>{port.city}, {port.country}</div>
                          ) : (
                            <div className="text-muted-foreground">Location not specified</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={port.customs_available ? 'default' : 'secondary'}>
                          {port.customs_available ? 'Available' : 'Not Available'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={port.is_active ? 'default' : 'secondary'}>
                          {port.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="icon" onClick={() => onEdit(port.id)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="destructive" size="icon" onClick={() => onDelete(port.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Port/Location</DialogTitle>
            </DialogHeader>
            {editingLocationId && (
              <PortLocationForm locationId={editingLocationId} onSuccess={handleEditSuccess} />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
