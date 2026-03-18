import DataImportExport, { DataField, ExportTemplate } from '@/components/system/DataImportExport';
import * as z from 'zod';
import { useNavigate } from 'react-router-dom';
import { CRM_HEADER_PRIMARY_CONTROL_SEQUENCE, CRMModuleHeaderNavigation } from '@/components/crm/CRMModuleHeaderNavigation';
import { LeadsPrimaryView, useLeadsViewState } from '@/hooks/useLeadsViewState';
import { themeStyleFromPreset } from '@/lib/theme-utils';

const leadFields: DataField[] = [
  { key: 'first_name', label: 'First Name', required: true, aliases: ['fname', 'given_name'] },
  { key: 'last_name', label: 'Last Name', required: true, aliases: ['lname', 'surname'] },
  { key: 'email', label: 'Email', aliases: ['email_address'] },
  { key: 'phone', label: 'Phone', aliases: ['mobile'] },
  { key: 'company', label: 'Company', aliases: ['organization'] },
  { key: 'title', label: 'Title', aliases: ['job_title'] },
  { key: 'status', label: 'Status' },
  { key: 'source', label: 'Source' },
  { key: 'estimated_value', label: 'Estimated Value', aliases: ['value', 'amount'] },
  { key: 'expected_close_date', label: 'Expected Close Date', aliases: ['close_date'] },
  { key: 'description', label: 'Description' },
  { key: 'notes', label: 'Notes' },
  { key: 'lead_score', label: 'Lead Score' },
  { key: 'qualification_status', label: 'Qualification Status' },
];

const leadExportFields: DataField[] = [
  { key: 'id', label: 'ID' },
  { key: 'created_at', label: 'Created At' },
  { key: 'updated_at', label: 'Updated At' },
  { key: 'owner_id', label: 'Owner ID' },
  ...leadFields
];

const leadSchema = z.object({
  first_name: z.preprocess(
    (val) => (val === null || val === undefined) ? '' : String(val),
    z.string().trim().min(1, 'First Name is required')
  ),
  last_name: z.preprocess(
    (val) => (val === null || val === undefined) ? '' : String(val),
    z.string().trim().min(1, 'Last Name is required')
  ),
  email: z.preprocess(
    (val) => (val === null || val === undefined || val === '') ? null : String(val),
    z.string().email().nullish()
  ),
  phone: z.preprocess(
    (val) => (val === null || val === undefined || val === '') ? null : String(val),
    z.string().nullish()
  ),
  status: z.preprocess(
    (val) => (val === null || val === undefined || val === '') ? null : String(val),
    z.string().nullish()
  ),
});

const defaultTemplate: ExportTemplate = {
  name: 'Standard',
  fields: ['first_name', 'last_name', 'email', 'phone', 'company', 'status', 'source'],
  includeCustomFields: true,
};

export default function LeadsImportExport() {
  const navigate = useNavigate();
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

  const handleHeaderViewModeChange = (mode: LeadsPrimaryView) => {
    if (mode === 'pipeline') {
      try {
        localStorage.setItem('leadsViewMode', 'pipeline');
      } catch {
        void 0;
      }
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
    setView(mode);
    navigate('/dashboard/leads');
  };

  return (
    <DataImportExport
      entityName="Leads"
      tableName="leads"
      fields={leadFields}
      exportFields={leadExportFields}
      validationSchema={leadSchema}
      defaultExportTemplate={defaultTemplate}
      listPath="/dashboard/leads"
      showBackToListButton={false}
      containerStyle={themeStyleFromPreset(currentTheme)}
      headerActions={
        <CRMModuleHeaderNavigation
          moduleLabel="Leads"
          viewMode="list"
          theme={currentTheme}
          onViewModeChange={(mode) => handleHeaderViewModeChange(mode as LeadsPrimaryView)}
          onThemeChange={handleThemeChange}
          onCreate={() => navigate('/dashboard/leads/new')}
          createLabel="New Lead"
          onRefresh={() => navigate(0)}
          analyticsActive={false}
          onAnalyticsClick={() => {
            try {
              localStorage.setItem('leadsViewMode', 'pipeline');
            } catch {
              void 0;
            }
            setView('pipeline');
            setPipeline({ q: '', status: [], tab: 'analytics' });
            navigate('/dashboard/leads/pipeline?view=analytics');
          }}
          onImportExport={() => navigate('/dashboard/leads/import-export')}
          controlSequence={CRM_HEADER_PRIMARY_CONTROL_SEQUENCE}
          iconOnly
          layout="compact"
        />
      }
    />
  );
}
