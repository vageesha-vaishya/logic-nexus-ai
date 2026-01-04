import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { WarehouseForm } from '@/components/logistics/WarehouseForm';
import type { WarehouseFormData } from '@/components/logistics/WarehouseForm';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

export default function WarehouseNew() {
  const navigate = useNavigate();
  const { supabase, context } = useCRM();

  const handleSubmit = async (data: WarehouseFormData) => {
    try {
      const warehouseData = {
        ...data,
        tenant_id: context.tenantId,
        franchise_id: context.franchiseId,
        address: { address: data.address },
        capacity_sqft: data.capacity_sqft ? parseFloat(data.capacity_sqft) : null,
      };

      const { error } = await supabase.from('warehouses').insert(warehouseData);

      if (error) throw error;

      toast.success('Warehouse created successfully');
      navigate('/dashboard/warehouses');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to create warehouse: ' + message);
      console.error('Error:', message);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard/warehouses')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">New Warehouse</h1>
            <p className="text-muted-foreground">Add a new warehouse location</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Warehouse Details</CardTitle>
            <CardDescription>
              Enter the warehouse information below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WarehouseForm
              onSubmit={handleSubmit}
              onCancel={() => navigate('/dashboard/warehouses')}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
