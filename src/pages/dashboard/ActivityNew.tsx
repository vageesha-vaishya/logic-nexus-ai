import { useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ActivityComposer } from '@/components/crm/ActivityComposer';
import { ArrowLeft } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

export default function ActivityNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { supabase, context } = useCRM();
  
  const leadId = searchParams.get('leadId');
  const accountId = searchParams.get('accountId');
  const contactId = searchParams.get('contactId');
  const type = (searchParams.get('type') as 'task' | 'event' | 'call' | 'email' | 'note' | null) || undefined;

  const related = {
    lead_id: leadId || undefined,
    account_id: accountId || undefined,
    contact_id: contactId || undefined,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/activities')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">New Activity</h1>
            <p className="text-muted-foreground">Schedule a new activity or task</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Activity Composer</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityComposer
              defaultTab={type}
              related={related}
              onCreated={() => navigate('/dashboard/activities')}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
