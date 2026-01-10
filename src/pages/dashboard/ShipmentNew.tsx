import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ShipmentForm } from '@/components/logistics/ShipmentForm';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { ScopedDataAccess, DataAccessContext } from '@/lib/db/access';

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
        pickup_date: data.pickup_date ? new Date(data.pickup_date).toISOString() : null,
        estimated_delivery_date: data.estimated_delivery_date ? new Date(data.estimated_delivery_date).toISOString() : null,
        total_weight_kg: data.total_weight_kg ? parseFloat(data.total_weight_kg) : null,
        total_volume_cbm: data.total_volume_cbm ? parseFloat(data.total_volume_cbm) : null,
        total_packages: data.total_packages ? parseInt(data.total_packages) : null,
        declared_value: typeof data.declared_value === 'number' ? data.declared_value : (data.declared_value ? parseFloat(data.declared_value) : null),
      };

      const dao = new ScopedDataAccess(supabase, context as unknown as DataAccessContext);

      // Create shipment and get the new ID to attach files under it
      const { data: inserted, error } = await dao
        .from('shipments')
        .insert([shipmentData])
        .select('id')
        .single();

      if (error) throw error;

      const shipmentId = inserted?.id;

      // Upload attachments to Supabase Storage (bucket: 'shipments')
      const files: File[] = Array.isArray(data.attachments) ? data.attachments : [];
      let uploadedCount = 0;
      let failedCount = 0;
      let firstErrorMsg: string | null = null;

      if (shipmentId && files.length > 0) {
        for (const file of files) {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const path = `${shipmentId}/${Date.now()}_${safeName}`;
          const { error: uploadError } = await supabase.storage
            .from('shipments')
            .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
          if (uploadError) {
            failedCount += 1;
            if (!firstErrorMsg) firstErrorMsg = uploadError.message;
          } else {
            uploadedCount += 1;

            // Save attachment metadata to shipment_attachments table
            const { data: urlData } = supabase.storage
              .from('shipments')
              .getPublicUrl(path);
            const publicUrl = urlData?.publicUrl ?? null;

            const { error: metaErr } = await (dao as any)
              .from('shipment_attachments')
              .insert([{
                shipment_id: shipmentId,
                tenant_id: context.tenantId,
                franchise_id: context.franchiseId,
                created_by: context.userId,
                name: file.name,
                path,
                size: file.size,
                content_type: file.type || null,
                public_url: publicUrl,
                document_type: 'other' // default type
              }]);
            if (metaErr) {
              // Count as failure to persist metadata, but keep upload success
              failedCount += 1;
              if (!firstErrorMsg) firstErrorMsg = `metadata: ${metaErr.message}`;
            }
          }
        }
      }

      // Notify result
      if (failedCount > 0) {
        toast.error('Shipment created, but some attachments failed to upload', {
          description: `${uploadedCount} uploaded, ${failedCount} failed${firstErrorMsg ? ` — ${firstErrorMsg}` : ''}`,
        });
      } else if (uploadedCount > 0) {
        toast.success('Shipment created with attachments uploaded', {
          description: `${uploadedCount} file${uploadedCount > 1 ? 's' : ''} uploaded to storage`,
        });
      } else {
        toast.success('Shipment created successfully');
      }

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