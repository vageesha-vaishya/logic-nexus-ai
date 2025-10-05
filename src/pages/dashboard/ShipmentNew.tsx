import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ShipmentForm } from '@/components/logistics/ShipmentForm';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

export default function ShipmentNew() {
  const navigate = useNavigate();
  const { supabase, context } = useCRM();

  const handleSubmit = async (data: any) => {
    try {
      const shipmentData = {
        ...data,
        tenant_id: context.tenantId,
        franchise_id: context.franchiseId,
        created_by: context.userId,
        origin_address: { address: data.origin_address },
        destination_address: { address: data.destination_address },
        total_weight_kg: data.total_weight_kg ? parseFloat(data.total_weight_kg) : null,
        total_volume_cbm: data.total_volume_cbm ? parseFloat(data.total_volume_cbm) : null,
        total_packages: data.total_packages ? parseInt(data.total_packages) : null,
        declared_value: data.declared_value ? parseFloat(data.declared_value) : null,
      };

      const { error } = await supabase.from('shipments').insert([shipmentData]);

      if (error) throw error;

      toast.success('Shipment created successfully');
      navigate('/dashboard/shipments');
    } catch (error: any) {
      toast.error('Failed to create shipment: ' + error.message);
      console.error('Error:', error);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard/shipments')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">New Shipment</h1>
            <p className="text-muted-foreground">Create a new shipment record</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Shipment Details</CardTitle>
            <CardDescription>
              Enter the shipment information below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ShipmentForm
              onSubmit={handleSubmit}
              onCancel={() => navigate('/dashboard/shipments')}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}