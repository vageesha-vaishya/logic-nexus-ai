import DataImportExport, { DataField, ExportTemplate } from '@/components/system/DataImportExport';
import { z } from 'zod';

const opportunityFields: DataField[] = [
  { key: 'name', label: 'Opportunity Name', required: true },
  { key: 'stage', label: 'Stage', type: 'select', options: ['prospecting', 'qualification', 'needs_analysis', 'value_proposition', 'proposal', 'negotiation', 'closed_won', 'closed_lost'] },
  { key: 'amount', label: 'Amount', type: 'number' },
  { key: 'probability', label: 'Probability', type: 'number' },
  { key: 'close_date', label: 'Close Date', type: 'date' },
  { key: 'expected_revenue', label: 'Expected Revenue', type: 'number' },
  { key: 'account_id', label: 'Account ID' },
  { key: 'contact_id', label: 'Contact ID' },
  { key: 'owner_id', label: 'Owner ID' },
  { key: 'lead_source', label: 'Lead Source' },
  { key: 'type', label: 'Type' },
  { key: 'next_step', label: 'Next Step' },
  { key: 'description', label: 'Description' },
];

const exportFields: DataField[] = [
  ...opportunityFields,
  { key: 'id', label: 'ID' },
  { key: 'created_at', label: 'Created At', type: 'date' },
  { key: 'updated_at', label: 'Updated At', type: 'date' },
  { key: 'closed_at', label: 'Closed At', type: 'date' },
  { key: 'salesforce_sync_status', label: 'Salesforce Sync Status' },
  { key: 'salesforce_last_synced', label: 'Salesforce Last Synced', type: 'date' },
];

const defaultExportTemplate: ExportTemplate = {
  id: 'default',
  name: 'Standard Export',
  fields: ['name', 'stage', 'amount', 'probability', 'close_date', 'expected_revenue'],
  includeCustomFields: false,
  format: 'csv',
};

const validationSchema = z.object({
  name: z.preprocess(
    (val) => (val === null || val === undefined) ? '' : String(val),
    z.string().trim().min(1, 'Opportunity Name is required')
  ),
  stage: z.preprocess(
    (val) => (val === null || val === undefined || val === '') ? 'prospecting' : String(val),
    z.enum(['prospecting', 'qualification', 'needs_analysis', 'value_proposition', 'proposal', 'negotiation', 'closed_won', 'closed_lost'])
  ),
  amount: z.preprocess(
    (val) => (val === null || val === undefined || val === '') ? null : Number(val),
    z.number().nullish()
  ),
  probability: z.preprocess(
    (val) => (val === null || val === undefined || val === '') ? null : Number(val),
    z.number().min(0).max(100).nullish()
  ),
});

export default function OpportunitiesImportExport() {
  return (
    <DataImportExport
      entityName="Opportunities"
      tableName="opportunities"
      fields={opportunityFields}
      exportFields={exportFields}
      validationSchema={validationSchema}
      defaultExportTemplate={defaultExportTemplate}
      listPath="/dashboard/opportunities"
    />
  );
}
