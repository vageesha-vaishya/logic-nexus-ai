import DataImportExport, { DataField, ExportTemplate } from '@/components/system/DataImportExport';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';

const quoteFields: DataField[] = [
  { key: 'quote_number', label: 'Quote Number', required: true, aliases: ['quote no', 'quote id'] },
  { key: 'title', label: 'Title', required: true, aliases: ['quote title', 'name'] },
  { key: 'status', label: 'Status', aliases: ['state'] },
  { key: 'account_id', label: 'Account ID', aliases: ['customer_id'] },
  { key: 'contact_id', label: 'Contact ID', aliases: ['customer_contact_id'] },
  { key: 'opportunity_id', label: 'Opportunity ID' },
  { key: 'carrier_id', label: 'Carrier ID' },
  { key: 'transport_mode', label: 'Transport Mode', aliases: ['mode'] },
  { key: 'origin', label: 'Origin', aliases: ['origin_location'] },
  { key: 'destination', label: 'Destination', aliases: ['destination_location'] },
  { key: 'currency', label: 'Currency' },
  { key: 'buy_price', label: 'Buy Price', aliases: ['cost'] },
  { key: 'sell_price', label: 'Sell Price', aliases: ['price', 'total_price'] },
  { key: 'validity_date', label: 'Validity Date', aliases: ['valid_until'] },
  { key: 'line_items_json', label: 'Line Items JSON', aliases: ['line_items', 'items'] },
  { key: 'pricing_tiers_json', label: 'Pricing Tiers JSON', aliases: ['pricing_tiers'] },
  { key: 'customer_snapshot_json', label: 'Customer Snapshot JSON', aliases: ['customer_details'] },
  { key: 'terms_conditions', label: 'Terms & Conditions', aliases: ['terms'] },
  { key: 'attachments_json', label: 'Attachments JSON', aliases: ['attachments'] },
  { key: 'custom_fields_json', label: 'Custom Fields JSON', aliases: ['custom_fields'] },
];

const quoteExportFields: DataField[] = [
  { key: 'id', label: 'ID' },
  { key: 'created_at', label: 'Created At' },
  { key: 'updated_at', label: 'Updated At' },
  ...quoteFields,
];

const defaultTemplate: ExportTemplate = {
  name: 'Standard',
  fields: [
    'quote_number',
    'title',
    'status',
    'account_id',
    'contact_id',
    'carrier_id',
    'currency',
    'sell_price',
    'validity_date',
    'terms_conditions',
  ],
  includeCustomFields: true,
  format: 'csv',
};

const sectionTemplate: ExportTemplate = {
  name: 'Section-wise',
  fields: [
    'quote_number',
    'title',
    'line_items_json',
    'pricing_tiers_json',
    'customer_snapshot_json',
    'terms_conditions',
    'attachments_json',
    'custom_fields_json',
  ],
  includeCustomFields: true,
  format: 'json',
};

export const quoteSchema = z.object({
  quote_number: z.preprocess(
    (val) => (val === null || val === undefined) ? '' : String(val),
    z.string().trim().min(1, 'Quote Number is required')
  ),
  title: z.preprocess(
    (val) => (val === null || val === undefined) ? '' : String(val),
    z.string().trim().min(1, 'Title is required')
  ),
  status: z.preprocess(
    (val) => (val === null || val === undefined || val === '') ? 'draft' : String(val).toLowerCase().trim(),
    z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired', 'cancelled'])
  ),
  sell_price: z.preprocess(
    (val) => (val === null || val === undefined || val === '') ? 0 : Number(val),
    z.number().min(0, 'Sell Price cannot be negative').max(10000000, 'Sell Price exceeds allowed limit')
  ),
  buy_price: z.preprocess(
    (val) => (val === null || val === undefined || val === '') ? 0 : Number(val),
    z.number().min(0, 'Buy Price cannot be negative').max(10000000, 'Buy Price exceeds allowed limit')
  ),
  currency: z.preprocess(
    (val) => (val === null || val === undefined || val === '') ? 'USD' : String(val).toUpperCase().trim(),
    z.string().length(3, 'Currency must be a 3-letter code')
  ),
  validity_date: z.preprocess(
    (val) => (val === null || val === undefined || val === '') ? null : String(val),
    z.string().nullish()
  ),
}).refine((data) => data.sell_price >= data.buy_price, {
  message: 'Sell Price must be greater than or equal to Buy Price',
  path: ['sell_price'],
});

export const parseJsonField = (value: unknown) => {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

export const transformQuoteRecord = (mapped: Record<string, unknown>) => {
  const customFields: Record<string, unknown> = {
    ...(typeof mapped.custom_fields_json === 'object' && mapped.custom_fields_json ? (mapped.custom_fields_json as Record<string, unknown>) : {}),
  };

  const lineItems = parseJsonField(mapped.line_items_json);
  const pricingTiers = parseJsonField(mapped.pricing_tiers_json);
  const customerSnapshot = parseJsonField(mapped.customer_snapshot_json);
  const attachments = parseJsonField(mapped.attachments_json);

  if (lineItems !== undefined) customFields.import_line_items = lineItems;
  if (pricingTiers !== undefined) customFields.import_pricing_tiers = pricingTiers;
  if (customerSnapshot !== undefined) customFields.import_customer_snapshot = customerSnapshot;
  if (attachments !== undefined) customFields.import_attachments = attachments;

  const transformed = {
    quote_number: String(mapped.quote_number || '').trim(),
    title: String(mapped.title || '').trim(),
    status: String(mapped.status || 'draft').toLowerCase().trim(),
    account_id: mapped.account_id || null,
    contact_id: mapped.contact_id || null,
    opportunity_id: mapped.opportunity_id || null,
    carrier_id: mapped.carrier_id || null,
    transport_mode: mapped.transport_mode || null,
    origin: mapped.origin || null,
    destination: mapped.destination || null,
    currency: String(mapped.currency || 'USD').toUpperCase().trim(),
    buy_price: mapped.buy_price === null || mapped.buy_price === undefined || mapped.buy_price === '' ? 0 : Number(mapped.buy_price),
    sell_price: mapped.sell_price === null || mapped.sell_price === undefined || mapped.sell_price === '' ? 0 : Number(mapped.sell_price),
    validity_date: mapped.validity_date || null,
    terms_conditions: mapped.terms_conditions || null,
    custom_fields: customFields,
  };

  return transformed;
};

export const prepareQuoteImportBatch = async (batch: any[]) => {
  const blockedRows: number[] = [];
  const expiredPartRows: number[] = [];

  batch.forEach((row, index) => {
    const customFields = row?.custom_fields as Record<string, unknown> | undefined;
    const creditStatus = String(customFields?.credit_status || '').toLowerCase();
    if (creditStatus === 'blocked' || creditStatus === 'hold') {
      blockedRows.push(index + 1);
    }

    const expiredFlag = customFields?.has_expired_part_numbers;
    if (expiredFlag === true || String(expiredFlag).toLowerCase() === 'true') {
      expiredPartRows.push(index + 1);
    }
  });

  if (blockedRows.length || expiredPartRows.length) {
    const parts: string[] = [];
    if (blockedRows.length) parts.push(`blocked credit status rows: ${blockedRows.slice(0, 20).join(', ')}`);
    if (expiredPartRows.length) parts.push(`expired part rows: ${expiredPartRows.slice(0, 20).join(', ')}`);
    throw new Error(`Business validation failed (${parts.join(' | ')})`);
  }

  return batch;
};

export default function QuotesImportExport() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode');
  const scope = searchParams.get('scope');
  const quoteId = searchParams.get('quoteId');
  const idsParam = searchParams.get('ids');
  const formatParam = searchParams.get('format');
  const selectedIds = useMemo(() => {
    if (!idsParam) return [];
    return idsParam
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  }, [idsParam]);
  const autoRunExportFormat = mode === 'export' && (formatParam === 'csv' || formatParam === 'xlsx' || formatParam === 'json')
    ? formatParam
    : undefined;
  const initialTemplateName = scope === 'section' ? sectionTemplate.name : defaultTemplate.name;

  const applyQuoteExportScope = (query: any) => {
    if (scope === 'single' && quoteId) {
      return query.eq('id', quoteId);
    }
    if (scope === 'selected' && selectedIds.length > 0) {
      return query.in('id', selectedIds);
    }
    if (quoteId) {
      return query.eq('id', quoteId);
    }
    return query;
  };

  return (
    <DataImportExport
      entityName="Quotes"
      tableName="quotes"
      fields={quoteFields}
      exportFields={quoteExportFields}
      validationSchema={quoteSchema}
      defaultExportTemplate={defaultTemplate}
      additionalExportTemplates={[sectionTemplate]}
      listPath="/dashboard/quotes"
      onTransformRecord={transformQuoteRecord}
      onPrepareImportBatch={prepareQuoteImportBatch}
      onExportFilterApply={applyQuoteExportScope}
      initialTemplateName={initialTemplateName}
      autoRunExportFormat={autoRunExportFormat}
      defaultDuplicateCriteria="quote_number"
      duplicateCriteriaOptions={[
        { value: 'quote_number', label: 'Quote Number' },
        { value: 'name', label: 'Title' },
        { value: 'custom', label: 'None (Allow all)' },
      ]}
    />
  );
}
