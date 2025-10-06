import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PortLocationForm } from '@/components/logistics/PortLocationForm';
import { Badge } from '@/components/ui/badge';
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
          await supabase.from('ports_locations').insert([
            {
              tenant_id: tenantId,
              location_name: 'Port of Los Angeles',
              location_code: 'USLAX',
              location_type: 'seaport',
              country: 'United States',
              city: 'Los Angeles',
              customs_available: true,
              is_active: true,
            },
            {
              tenant_id: tenantId,
              location_name: 'Singapore Changi Airport',
              location_code: 'SIN',
              location_type: 'airport',
              country: 'Singapore',
              city: 'Singapore',
              customs_available: true,
              is_active: true,
            },
            {
              tenant_id: tenantId,
              location_name: 'Mumbai Inland Port',
              location_code: 'INBOM-IP',
              location_type: 'inland_port',
              country: 'India',
              city: 'Mumbai',
              customs_available: false,
              is_active: true,
            },
          ]);
          toast.success('Seeded demo ports/locations');
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
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Ports & Locations</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading ports/locations...</div>
            ) : ports.length === 0 ? (
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ports.map((port) => (
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
