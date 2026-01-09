import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ContactForm } from '@/components/crm/ContactForm';
import { ArrowLeft } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

export default function ContactNew() {
  const navigate = useNavigate();
  const { supabase, context } = useCRM();

  const handleCreate = async (formData: any) => {
    try {
      const tenant_id = context.isPlatformAdmin ? formData.tenant_id : context.tenantId;
      
      if (!tenant_id) {
        toast.error('Tenant is required');
        return;
      }

      const { data, error } = await supabase
        .from('contacts')
        .insert({
          ...formData,
          tenant_id,
          franchise_id: formData.franchise_id || context.franchiseId,
          account_id: formData.account_id === 'none' || formData.account_id === '' ? null : formData.account_id,
          reports_to: formData.reports_to === 'none' || formData.reports_to === '' ? null : formData.reports_to,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Contact created successfully');
      navigate(`/dashboard/contacts/${data.id}`);
    } catch (error: any) {
      toast.error('Failed to create contact');
      console.error('Error:', error);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/contacts')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">New Contact</h1>
            <p className="text-muted-foreground">Add a new contact to your CRM</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent>
            <ContactForm
              onSubmit={handleCreate}
              onCancel={() => navigate('/dashboard/contacts')}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
