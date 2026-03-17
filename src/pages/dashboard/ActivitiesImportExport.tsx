import DataImportExport, { DataField, ExportTemplate } from '@/components/system/DataImportExport';
import { z } from 'zod';

const activityFields: DataField[] = [
  { key: 'subject', label: 'Subject', required: true },
  { key: 'activity_type', label: 'Activity Type', type: 'select', options: ['task', 'meeting', 'call', 'email', 'note'] },
  { key: 'status', label: 'Status', type: 'select', options: ['planned', 'in_progress', 'completed', 'cancelled'] },
  { key: 'priority', label: 'Priority', type: 'select', options: ['low', 'medium', 'high', 'urgent'] },
  { key: 'due_date', label: 'Due Date', type: 'date' },
  { key: 'description', label: 'Description' },
  { key: 'account_id', label: 'Account ID' },
  { key: 'contact_id', label: 'Contact ID' },
  { key: 'lead_id', label: 'Lead ID' },
  { key: 'assigned_to', label: 'Assigned To' },
];

const exportFields: DataField[] = [
  ...activityFields,
  { key: 'id', label: 'ID' },
  { key: 'created_at', label: 'Created At', type: 'date' },
  { key: 'updated_at', label: 'Updated At', type: 'date' },
  { key: 'completed_at', label: 'Completed At', type: 'date' },
];

const defaultExportTemplate: ExportTemplate = {
  id: 'default',
  name: 'Standard Export',
  fields: ['subject', 'activity_type', 'status', 'priority', 'due_date', 'assigned_to'],
  includeCustomFields: false,
  format: 'csv',
};

const validationSchema = z.object({
  subject: z.preprocess(
    (val) => (val === null || val === undefined) ? '' : String(val),
    z.string().trim().min(1, 'Subject is required')
  ),
  activity_type: z.preprocess(
    (val) => (val === null || val === undefined || val === '') ? 'task' : String(val),
    z.enum(['task', 'meeting', 'call', 'email', 'note'])
  ),
  status: z.preprocess(
    (val) => (val === null || val === undefined || val === '') ? 'planned' : String(val),
    z.enum(['planned', 'in_progress', 'completed', 'cancelled'])
  ),
});

export default function ActivitiesImportExport() {
  return (
    <DataImportExport
      entityName="Activities"
      tableName="activities"
      fields={activityFields}
      exportFields={exportFields}
      validationSchema={validationSchema}
      defaultExportTemplate={defaultExportTemplate}
      listPath="/dashboard/activities"
    />
  );
}
