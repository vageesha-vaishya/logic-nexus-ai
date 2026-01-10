import DataImportExport, { DataField, ExportTemplate } from '@/components/system/DataImportExport';
import { z } from 'zod';

const accountFields: DataField[] = [
  { key: 'name', label: 'Account Name', required: true },
  { key: 'industry', label: 'Industry' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email', validationPattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  { key: 'website', label: 'Website' },
  { key: 'description', label: 'Description' },
  { key: 'account_type', label: 'Account Type', type: 'select', options: ['prospect', 'customer', 'partner', 'vendor'] },
  { key: 'status', label: 'Status', type: 'select', options: ['active', 'inactive', 'pending'] },
  { key: 'annual_revenue', label: 'Annual Revenue', type: 'number' },
  { key: 'employee_count', label: 'Employee Count', type: 'number' },
];

const exportFields: DataField[] = [
  ...accountFields,
  { key: 'created_at', label: 'Created At', type: 'date' },
  { key: 'updated_at', label: 'Updated At', type: 'date' },
  { key: 'shipping_address', label: 'Shipping Address' },
  { key: 'billing_address', label: 'Billing Address' },
];

const defaultExportTemplate: ExportTemplate = {
  id: 'default',
  name: 'Standard Export',
  fields: ['name', 'industry', 'phone', 'email', 'status', 'account_type'],
  includeCustomFields: false,
  format: 'csv'
};

const validationSchema = z.object({
  name: z.preprocess(
    (val) => (val === null || val === undefined) ? '' : String(val),
    z.string().trim().min(1, 'Account Name is required')
  ),
  email: z.preprocess(
    (val) => (val === null || val === undefined || val === '') ? null : String(val),
    z.string().email().nullish()
  ),
  website: z.preprocess(
    (val) => (val === null || val === undefined || val === '') ? null : String(val),
    z.string().url().nullish()
  ),
  annual_revenue: z.preprocess(
    (val) => (val === null || val === undefined || val === '') ? null : Number(val),
    z.number().nullish()
  ),
  employee_count: z.preprocess(
    (val) => (val === null || val === undefined || val === '') ? null : Number(val),
    z.number().int().nullish()
  ),
});

export default function AccountsImportExport() {
  return (
      <DataImportExport
        entityName="Accounts"
        tableName="accounts"
        fields={accountFields}
        exportFields={exportFields}
        validationSchema={validationSchema}
        defaultExportTemplate={defaultExportTemplate}
        listPath="/dashboard/accounts"
      />
  );
}
