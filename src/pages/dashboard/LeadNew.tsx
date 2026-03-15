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
import { CRMModuleHeaderNavigation } from '@/components/crm/CRMModuleHeaderNavigation';
import { themeStyleFromPreset } from '@/lib/theme-utils';
import { useLeadsViewState, LeadsPrimaryView } from '@/hooks/useLeadsViewState';

export default function LeadNew() {
  const navigate = useNavigate();
  const { context, scopedDb } = useCRM();
  const { state: viewState, setTheme, setView, setPipeline } = useLeadsViewState();
  const currentTheme = viewState.theme;

  const handleThemeChange = (val: string) => {
    setTheme(val);
    try {
      localStorage.setItem('leadsTheme', val);
    } catch {
      return;
    }
  };

  const handleViewModeChange = (mode: LeadsPrimaryView) => {
    if (mode === 'pipeline') {
      try {
        localStorage.setItem('leadsViewMode', 'pipeline');
      } catch {
        void 0;
      }
      scopedDb.logViewPreference('leads', 'pipeline');
      setView('pipeline');
      setPipeline({ q: '', status: [], tab: 'board' });
      navigate('/dashboard/leads/pipeline');
      return;
    }

    try {
      localStorage.setItem('leadsViewMode', mode);
    } catch {
      void 0;
    }
    scopedDb.logViewPreference('leads', mode);
    setView(mode);
    navigate('/dashboard/leads');
  };

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
      <div style={themeStyleFromPreset(currentTheme)} className="space-y-6 transition-colors duration-300">
        <div className="flex items-start justify-between gap-4 sm:items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/leads')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">New Lead</h1>
              <p className="text-muted-foreground">Create a new sales lead</p>
            </div>
          </div>
          <CRMModuleHeaderNavigation
            moduleLabel="Leads"
            viewMode="list"
            theme={currentTheme}
            onViewModeChange={(mode) => handleViewModeChange(mode as LeadsPrimaryView)}
            onThemeChange={handleThemeChange}
            onCreate={() => navigate('/dashboard/leads/new')}
            createLabel="New Lead"
            onRefresh={() => navigate(0)}
            onAnalyticsClick={() => {
              try {
                localStorage.setItem('leadsViewMode', 'pipeline');
              } catch {
                void 0;
              }
              scopedDb.logViewPreference('leads', 'pipeline');
              setView('pipeline');
              setPipeline({ q: '', status: [], tab: 'analytics' });
              navigate('/dashboard/leads/pipeline?view=analytics');
            }}
            analyticsActive={false}
            onImportExport={() => navigate('/dashboard/leads/import-export')}
            controlSequence={['pipeline', 'list', 'create', 'card', 'grid', 'refresh', 'analytics', 'importExport', 'theme']}
            iconOnly
            layout="compact"
          />
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
