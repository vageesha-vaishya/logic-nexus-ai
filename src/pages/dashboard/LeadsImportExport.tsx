import DataImportExport, { DataField, ExportTemplate } from '@/components/system/DataImportExport';
import * as z from 'zod';

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
  first_name: z.string().trim().min(1, 'First Name is required'),
  last_name: z.string().trim().min(1, 'Last Name is required'),
  email: z.string().email().nullish().or(z.literal('')),
  phone: z.string().nullish(),
  status: z.string().nullish(), // Could use enum validation if strict
});

const defaultTemplate: ExportTemplate = {
  name: 'Standard',
  fields: ['first_name', 'last_name', 'email', 'phone', 'company', 'status', 'source'],
  includeCustomFields: true,
};

export default function LeadsImportExport() {
  return (
    <DataImportExport
      entityName="Leads"
      tableName="leads"
      fields={leadFields}
      exportFields={leadExportFields}
      validationSchema={leadSchema}
      defaultExportTemplate={defaultTemplate}
      listPath="/dashboard/leads"
    />
  );
}
