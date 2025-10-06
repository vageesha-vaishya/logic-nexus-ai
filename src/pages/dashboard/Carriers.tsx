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
import { CarrierForm } from '@/components/logistics/CarrierForm';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function Carriers() {
  const navigate = useNavigate();
  const { supabase, context } = useCRM();
  const { roles } = useAuth();
  const [carriers, setCarriers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (context.isPlatformAdmin || context.tenantId || roles?.[0]?.tenant_id) {
      fetchCarriers();
    } else {
      setLoading(false);
    }
  }, [context.isPlatformAdmin, context.tenantId, roles]);

  const fetchCarriers = async () => {
    const tenantId = context.tenantId || roles?.[0]?.tenant_id;
    const isPlatform = context.isPlatformAdmin;
    if (!isPlatform && !tenantId) {
      setLoading(false);
      return;
    }

    try {
      let query = supabase
        .from('carriers')
        .select('*');
      if (!isPlatform) {
        query = query.eq('tenant_id', tenantId as string);
      }
      const { data, error } = await query.order('carrier_name');

      if (error) throw error;
      const rows = data || [];
      // Dev-only: auto-seed a few demo carriers if none exist (only when tenant scoped)
      if (!isPlatform && rows.length === 0 && import.meta.env.DEV) {
        try {
          await supabase.from('carriers').insert([
            {
              tenant_id: tenantId,
              carrier_name: 'Maersk',
              carrier_code: 'MAEU',
              carrier_type: 'ocean',
              contact_person: 'Alex Jensen',
              contact_email: 'alex@maersk.example',
              contact_phone: '+1-555-3001',
              rating: 4.6,
              is_active: true,
            },
            {
              tenant_id: tenantId,
              carrier_name: 'DHL Express',
              carrier_code: 'DHL',
              carrier_type: 'courier',
              contact_person: 'Taylor Reed',
              contact_email: 'taylor@dhl.example',
              contact_phone: '+1-555-3002',
              rating: 4.4,
              is_active: true,
            },
            {
              tenant_id: tenantId,
              carrier_name: 'United Cargo',
              carrier_code: 'UA',
              carrier_type: 'air',
              contact_person: 'Jordan Kim',
              contact_email: 'jordan@united.example',
              contact_phone: '+1-555-3003',
              rating: 4.2,
              is_active: true,
            },
            {
              tenant_id: tenantId,
              carrier_name: 'Swift Trucking',
              carrier_code: 'SWFT',
              carrier_type: 'trucking',
              contact_person: 'Morgan Lee',
              contact_email: 'morgan@swift.example',
              contact_phone: '+1-555-3004',
              rating: 4.0,
              is_active: true,
            },
          ]);
          toast.success('Seeded demo carriers');
          const { data: seeded } = await supabase
            .from('carriers')
            .select('*')
            .eq('tenant_id', tenantId as string)
            .order('carrier_name');
          setCarriers(seeded || []);
        } catch (seedErr: any) {
          console.warn('Carrier seed failed:', seedErr?.message || seedErr);
          setCarriers([]);
        }
      } else {
        setCarriers(rows);
      }
    } catch (error: any) {
      toast.error('Failed to load carriers', {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    setDialogOpen(false);
    fetchCarriers();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Carriers</h1>
            <p className="text-muted-foreground">Manage shipping carriers and service providers</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Carrier
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Carrier</DialogTitle>
              </DialogHeader>
              <CarrierForm onSuccess={handleSuccess} />
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Carriers</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading carriers...</div>
            ) : carriers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No carriers found. Create your first carrier to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Carrier Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {carriers.map((carrier) => (
                    <TableRow key={carrier.id}>
                      <TableCell className="font-medium">{carrier.carrier_name}</TableCell>
                      <TableCell>{carrier.carrier_code || 'N/A'}</TableCell>
                      <TableCell>
                        {carrier.carrier_type && (
                          <Badge variant="outline">
                            {carrier.carrier_type.replace('_', ' ').toUpperCase()}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {carrier.contact_person && (
                          <div className="text-sm">
                            <div>{carrier.contact_person}</div>
                            {carrier.contact_email && (
                              <div className="text-muted-foreground">{carrier.contact_email}</div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {carrier.rating ? (
                          <span>{carrier.rating} / 5.0</span>
                        ) : (
                          'N/A'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={carrier.is_active ? 'default' : 'secondary'}>
                          {carrier.is_active ? 'Active' : 'Inactive'}
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
