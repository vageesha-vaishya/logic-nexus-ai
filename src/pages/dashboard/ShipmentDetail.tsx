import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, MapPin, Calendar, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TrackingTimeline } from '@/components/logistics/TrackingTimeline';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function ShipmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [shipment, setShipment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { supabase } = useCRM();

  useEffect(() => {
    if (id) fetchShipment();
  }, [id]);

  const fetchShipment = async () => {
    try {
      const { data, error } = await supabase
        .from('shipments')
        .select('*, accounts(name), contacts(first_name, last_name)')
        .eq('id', id)
        .single();

      if (error) throw error;
      setShipment(data);
    } catch (error: any) {
      toast.error('Failed to load shipment');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-500/10 text-gray-500',
      confirmed: 'bg-blue-500/10 text-blue-500',
      in_transit: 'bg-purple-500/10 text-purple-500',
      customs: 'bg-yellow-500/10 text-yellow-500',
      out_for_delivery: 'bg-orange-500/10 text-orange-500',
      delivered: 'bg-green-500/10 text-green-500',
      cancelled: 'bg-red-500/10 text-red-500',
      on_hold: 'bg-gray-600/10 text-gray-600',
      returned: 'bg-red-400/10 text-red-400',
    };
    return colors[status] || 'bg-gray-500/10 text-gray-500';
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">Loading shipment...</div>
      </DashboardLayout>
    );
  }

  if (!shipment) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">Shipment not found</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard/shipments')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{shipment.shipment_number}</h1>
              <p className="text-muted-foreground">
                {shipment.shipment_type.replace('_', ' ')}
              </p>
            </div>
            <Badge className={getStatusColor(shipment.status)}>
              {shipment.status.replace('_', ' ')}
            </Badge>
          </div>
          <Button>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Shipment Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Reference Number</p>
                  <p className="font-medium">{shipment.reference_number || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Priority</p>
                  <Badge variant="outline">{shipment.priority_level}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Packages</p>
                  <p className="font-medium">{shipment.total_packages || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Weight</p>
                  <p className="font-medium">{shipment.total_weight_kg ? `${shipment.total_weight_kg} kg` : '-'}</p>
                </div>
              </div>

              {shipment.accounts && (
                <div>
                  <p className="text-sm text-muted-foreground">Customer</p>
                  <p className="font-medium">{shipment.accounts.name}</p>
                </div>
              )}

              {shipment.special_instructions && (
                <div>
                  <p className="text-sm text-muted-foreground">Special Instructions</p>
                  <p className="font-medium">{shipment.special_instructions}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dates & Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Pickup Date</p>
                  <p className="font-medium">
                    {shipment.pickup_date ? format(new Date(shipment.pickup_date), 'PPP') : 'Not scheduled'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Estimated Delivery</p>
                  <p className="font-medium">
                    {shipment.estimated_delivery_date ? format(new Date(shipment.estimated_delivery_date), 'PPP') : 'TBD'}
                  </p>
                </div>
              </div>

              {shipment.actual_delivery_date && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Actual Delivery</p>
                    <p className="font-medium">
                      {format(new Date(shipment.actual_delivery_date), 'PPP')}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <CardTitle>Origin</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p>{shipment.origin_address?.address || JSON.stringify(shipment.origin_address)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <CardTitle>Destination</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p>{shipment.destination_address?.address || JSON.stringify(shipment.destination_address)}</p>
            </CardContent>
          </Card>
        </div>

        {id && <TrackingTimeline shipmentId={id} />}
      </div>
    </DashboardLayout>
  );
}