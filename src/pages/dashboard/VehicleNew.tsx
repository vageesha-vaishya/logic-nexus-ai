import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { VehicleForm } from '@/components/logistics/VehicleForm';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

export default function VehicleNew() {
  const navigate = useNavigate();
  const { supabase, context } = useCRM();

  const handleSubmit = async (data: any) => {
    try {
      const vehicleData = {
        ...data,
        tenant_id: context.tenantId,
        franchise_id: context.franchiseId,
        year: data.year ? parseInt(data.year) : null,
        capacity_kg: data.capacity_kg ? parseFloat(data.capacity_kg) : null,
        capacity_cbm: data.capacity_cbm ? parseFloat(data.capacity_cbm) : null,
      };

      const { error } = await supabase.from('vehicles').insert([vehicleData]);

      if (error) throw error;

      toast.success('Vehicle created successfully');
      navigate('/dashboard/vehicles');
    } catch (error: any) {
      toast.error('Failed to create vehicle: ' + error.message);
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
            onClick={() => navigate('/dashboard/vehicles')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">New Vehicle</h1>
            <p className="text-muted-foreground">Add a new vehicle to your fleet</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Vehicle Details</CardTitle>
            <CardDescription>
              Enter the vehicle information below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VehicleForm
              onSubmit={handleSubmit}
              onCancel={() => navigate('/dashboard/vehicles')}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}