import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LeadForm } from '@/components/crm/LeadForm';
import { ArrowLeft } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import * as Sentry from '@sentry/react';

export default function LeadNew() {
  const navigate = useNavigate();
  const { context, scopedDb } = useCRM();

  const handleCreate = async (formData: any) => {
    try {
      const tenantId = context.isPlatformAdmin 
        ? formData.tenant_id 
        : context.tenantId;

      if (!tenantId) {
        toast.error('Please select a tenant');
        return;
      }

      // Extract non-column extras and persist them into custom_fields
      const { service_id, attachments, ...rest } = formData || {};
      const attachmentNames = Array.isArray(attachments)
        ? attachments.map((f: File) => f.name)
        : [];
      const customFields: Record<string, any> = {
        ...(rest?.custom_fields || {}),
        ...(service_id ? { service_id } : {}),
        ...(attachmentNames.length ? { attachments_names: attachmentNames } : {}),
      };

      const { data, error } = await scopedDb
        .from('leads')
        .insert({
          ...rest,
          tenant_id: tenantId,
          franchise_id: formData.franchise_id || context.franchiseId,
          estimated_value: formData.estimated_value ? parseFloat(formData.estimated_value) : null,
          expected_close_date: formData.expected_close_date || null,
          custom_fields: Object.keys(customFields).length ? customFields : null,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Lead created successfully');
      navigate(`/dashboard/leads/${data.id}`);
    } catch (error: any) {
      toast.error('Failed to create lead');
      logger.error('Failed to create lead', {
        error: error instanceof Error ? error.message : String(error),
      });
      Sentry.captureException(error);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/leads')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">New Lead</h1>
            <p className="text-muted-foreground">Create a new sales lead</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lead Information</CardTitle>
          </CardHeader>
          <CardContent>
            <LeadForm
              onSubmit={handleCreate}
              onCancel={() => navigate('/dashboard/leads')}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
