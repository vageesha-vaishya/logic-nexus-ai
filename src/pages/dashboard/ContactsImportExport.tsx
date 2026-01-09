import DataImportExport, { DataField, ExportTemplate } from '@/components/system/DataImportExport';
import { z } from 'zod';

const contactFields: DataField[] = [
  { key: 'first_name', label: 'First Name', required: true },
  { key: 'last_name', label: 'Last Name', required: true },
  { key: 'email', label: 'Email', validationPattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  { key: 'phone', label: 'Phone' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'title', label: 'Title' },
  { key: 'account_id', label: 'Account ID' },
  { key: 'linkedin_url', label: 'LinkedIn URL' },
  { key: 'notes', label: 'Notes' },
];

const exportFields: DataField[] = [
  ...contactFields,
  { key: 'created_at', label: 'Created At', type: 'date' },
  { key: 'updated_at', label: 'Updated At', type: 'date' },
  { key: 'is_primary', label: 'Is Primary', type: 'boolean' },
  { key: 'address', label: 'Address' },
];

const defaultExportTemplate: ExportTemplate = {
  id: 'default',
  name: 'Standard Export',
  fields: ['first_name', 'last_name', 'email', 'phone', 'title', 'account_id'],
  includeCustomFields: false,
  format: 'csv'
};

const validationSchema = z.object({
  first_name: z.string().trim().min(1, 'First Name is required'),
  last_name: z.string().trim().min(1, 'Last Name is required'),
  email: z.string().email().nullish().or(z.literal('')),
});

export default function ContactsImportExport() {
  return (
      <DataImportExport
        entityName="Contacts"
        tableName="contacts"
        fields={contactFields}
        exportFields={exportFields}
        validationSchema={validationSchema}
        defaultExportTemplate={defaultExportTemplate}
        listPath="/dashboard/contacts"
      />
  );
}
