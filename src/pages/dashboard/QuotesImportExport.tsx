import DataImportExport, { DataField, ExportTemplate } from '@/components/system/DataImportExport';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const splitQuoteReferences = (refs: string[]) => {
  const ids: string[] = [];
  const quoteNumbers: string[] = [];
  const seenIds = new Set<string>();
  const seenQuoteNumbers = new Set<string>();
  for (const raw of refs) {
    const ref = String(raw || '').trim();
    if (!ref) continue;
    if (UUID_REGEX.test(ref)) {
      if (!seenIds.has(ref)) {
        seenIds.add(ref);
        ids.push(ref);
      }
      continue;
    }
    if (!seenQuoteNumbers.has(ref)) {
      seenQuoteNumbers.add(ref);
      quoteNumbers.push(ref);
    }
  }
  return { ids, quoteNumbers };
};

type QuoteRow = Record<string, any>;
type QuoteItemRow = Record<string, any>;
type QuoteCargoRow = Record<string, any>;
type QuoteVersionRow = Record<string, any>;

export const buildFullQuoteExportSheets = (
  quotes: QuoteRow[],
  quoteItems: QuoteItemRow[],
  quoteCargo: QuoteCargoRow[],
  versions: QuoteVersionRow[],
) => {
  const quoteNumberById = new Map<string, string>();
  quotes.forEach((quote) => {
    quoteNumberById.set(String(quote.id), String(quote.quote_number || quote.id || ''));
  });

  const summarySheet = quotes.map((quote) => ({
    quote_id: quote.id || '',
    quote_number: quote.quote_number || '',
    title: quote.title || '',
    status: quote.status || '',
    transport_mode: quote.transport_mode || '',
    origin: quote.origin || '',
    destination: quote.destination || '',
    currency: quote.currency || '',
    buy_price: quote.buy_price ?? '',
    sell_price: quote.sell_price ?? '',
    validity_date: quote.validity_date || quote.valid_until || '',
    pickup_date: quote.pickup_date || '',
    delivery_deadline: quote.delivery_deadline || '',
    terms_conditions: quote.terms_conditions || '',
    notes: quote.notes || '',
    created_at: quote.created_at || '',
    updated_at: quote.updated_at || '',
  }));

  const itemsSheet = quoteItems.map((item) => ({
    quote_id: item.quote_id || '',
    quote_number: quoteNumberById.get(String(item.quote_id || '')) || '',
    line_number: item.line_number ?? '',
    product_name: item.product_name || '',
    description: item.description || '',
    quantity: item.quantity ?? '',
    unit_price: item.unit_price ?? '',
    discount_percent: item.discount_percent ?? '',
    total_price: item.total_price ?? '',
    commodity_id: item.commodity_id || '',
    aes_hts_id: item.aes_hts_id || '',
  }));

  const cargoSheet = quoteCargo.map((cargo) => ({
    quote_id: cargo.quote_id || '',
    quote_number: quoteNumberById.get(String(cargo.quote_id || '')) || '',
    container_type_id: cargo.container_type_id || '',
    container_size_id: cargo.container_size_id || '',
    quantity: cargo.quantity ?? '',
    cargo_type: cargo.cargo_type || '',
    dimensions: cargo.dimensions ? JSON.stringify(cargo.dimensions) : '',
    stackable: cargo.stackable ?? '',
    requires_refrigeration: cargo.requires_refrigeration ?? '',
    hazardous: cargo.hazardous ?? '',
    metadata: cargo.metadata ? JSON.stringify(cargo.metadata) : '',
  }));

  const optionSheet: Record<string, any>[] = [];
  const legsSheet: Record<string, any>[] = [];
  const chargesSheet: Record<string, any>[] = [];

  versions.forEach((version) => {
    const quoteId = String(version.quote_id || '');
    const quoteNumber = quoteNumberById.get(quoteId) || '';
    const options = Array.isArray(version.quotation_version_options) ? version.quotation_version_options : [];
    options.forEach((option: any) => {
      optionSheet.push({
        quote_id: quoteId,
        quote_number: quoteNumber,
        version_id: version.id || '',
        version_number: version.version_number ?? '',
        option_id: option.id || '',
        is_selected: option.is_selected ?? '',
        total_amount: option.total_amount ?? '',
        quote_currency: option.quote_currency?.code || '',
        total_transit_days: option.total_transit_days ?? '',
      });

      const legs = Array.isArray(option.quotation_version_option_legs) ? option.quotation_version_option_legs : [];
      legs.forEach((leg: any) => {
        legsSheet.push({
          quote_id: quoteId,
          quote_number: quoteNumber,
          version_number: version.version_number ?? '',
          option_id: option.id || '',
          leg_id: leg.id || '',
          sort_order: leg.sort_order ?? '',
          mode: leg.mode || '',
          provider_id: leg.provider_id || '',
          origin_location: leg.origin_location || '',
          destination_location: leg.destination_location || '',
          departure_date: leg.departure_date || '',
          arrival_date: leg.arrival_date || '',
          transit_time_hours: leg.transit_time_hours ?? '',
          flight_number: leg.flight_number || '',
          voyage_number: leg.voyage_number || '',
        });

        const legCharges = Array.isArray(leg.quotation_version_option_leg_charges) ? leg.quotation_version_option_leg_charges : [];
        legCharges.forEach((charge: any) => {
          chargesSheet.push({
            quote_id: quoteId,
            quote_number: quoteNumber,
            version_number: version.version_number ?? '',
            option_id: option.id || '',
            leg_id: leg.id || '',
            charge_id: charge.id || '',
            description: charge.description?.name || '',
            amount: charge.amount ?? '',
            rate: charge.rate ?? '',
            quantity: charge.quantity ?? '',
            currency: charge.currency?.code || '',
            charge_code: charge.charge_code || '',
            charge_side: charge.charge_sides?.code || '',
            basis: charge.basis?.code || '',
            note: charge.note || '',
          });
        });
      });
    });
  });

  const metadataSheet = [{
    exported_at: new Date().toISOString(),
    quote_count: quotes.length,
    item_count: itemsSheet.length,
    cargo_count: cargoSheet.length,
    option_count: optionSheet.length,
    leg_count: legsSheet.length,
    charge_count: chargesSheet.length,
  }];

  return {
    Summary: summarySheet,
    Options: optionSheet,
    Transport_Legs: legsSheet,
    Charges: chargesSheet,
    Quote_Items: itemsSheet,
    Cargo_Configurations: cargoSheet,
    Metadata: metadataSheet,
  };
};

export default function QuotesImportExport() {
  const [searchParams] = useSearchParams();
  const { scopedDb } = useCRM();
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
      if (UUID_REGEX.test(quoteId)) {
        return query.eq('id', quoteId);
      }
      return query.eq('quote_number', quoteId);
    }
    if (scope === 'selected' && selectedIds.length > 0) {
      const { ids, quoteNumbers } = splitQuoteReferences(selectedIds);
      if (ids.length > 0) {
        query = query.in('id', ids);
      }
      if (quoteNumbers.length > 0 && ids.length === 0) {
        query = query.in('quote_number', quoteNumbers);
      }
      return query;
    }
    if (quoteId) {
      if (UUID_REGEX.test(quoteId)) {
        return query.eq('id', quoteId);
      }
      return query.eq('quote_number', quoteId);
    }
    return query;
  };

  const handleFullQuoteExport = async ({ format }: { format: 'xlsx' | 'csv' | 'json' }) => {
    if (format !== 'xlsx') return false;

    const scopeRefs = scope === 'selected'
      ? selectedIds
      : (quoteId ? [quoteId] : []);

    const { ids, quoteNumbers } = splitQuoteReferences(scopeRefs);
    const quoteRows: Record<string, any>[] = [];

    if (ids.length > 0) {
      const { data, error } = await scopedDb.from('quotes').select('*').in('id', ids);
      if (error) throw error;
      if (Array.isArray(data)) quoteRows.push(...data);
    }
    if (quoteNumbers.length > 0) {
      const { data, error } = await scopedDb.from('quotes').select('*').in('quote_number', quoteNumbers);
      if (error) throw error;
      if (Array.isArray(data)) {
        const existing = new Set(quoteRows.map((q) => String(q.id)));
        data.forEach((row: any) => {
          if (!existing.has(String(row.id))) quoteRows.push(row);
        });
      }
    }
    if (scopeRefs.length === 0) {
      const { data, error } = await applyQuoteExportScope(scopedDb.from('quotes').select('*'));
      if (error) throw error;
      if (Array.isArray(data)) quoteRows.push(...data);
    }

    if (quoteRows.length === 0) {
      toast.info('No records found to export');
      return true;
    }

    const quoteIds = quoteRows.map((row) => String(row.id));
    const [itemsRes, cargoRes, versionsRes] = await Promise.all([
      scopedDb.from('quote_items', true).select('*').in('quote_id', quoteIds).order('quote_id', { ascending: true }).order('line_number', { ascending: true }),
      scopedDb.from('quote_cargo_configurations', true).select('*').in('quote_id', quoteIds).order('quote_id', { ascending: true }),
      scopedDb.from('quotation_versions').select(`
        id,
        quote_id,
        version_number,
        quotation_version_options (
          id,
          is_selected,
          total_amount,
          quote_currency:quote_currency_id (code),
          total_transit_days,
          quotation_version_option_legs (
            id,
            sort_order,
            mode,
            provider_id,
            origin_location,
            destination_location,
            origin_location_id,
            destination_location_id,
            transit_time_hours,
            flight_number,
            voyage_number,
            departure_date,
            arrival_date,
            quotation_version_option_leg_charges:quote_charges (
              id,
              amount,
              rate,
              quantity,
              currency_id,
              currency:currencies(code),
              charge_code:category_id,
              charge_sides(code),
              charge_side_id,
              basis:charge_bases(code),
              unit:charge_bases(code),
              description:charge_categories(name),
              note
            )
          )
        )
      `).in('quote_id', quoteIds).order('quote_id', { ascending: true }).order('version_number', { ascending: false }),
    ]);

    if (itemsRes.error) throw itemsRes.error;
    if (cargoRes.error) throw cargoRes.error;
    if (versionsRes.error) throw versionsRes.error;

    const sheets = buildFullQuoteExportSheets(
      quoteRows,
      Array.isArray(itemsRes.data) ? itemsRes.data : [],
      Array.isArray(cargoRes.data) ? cargoRes.data : [],
      Array.isArray(versionsRes.data) ? versionsRes.data : [],
    );

    const wb = XLSX.utils.book_new();
    Object.entries(sheets).forEach(([sheetName, rows]) => {
      const worksheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ notice: 'No data' }]);
      XLSX.utils.book_append_sheet(wb, worksheet, sheetName.slice(0, 31));
    });

    XLSX.writeFile(wb, `Quotes_Full_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Export completed successfully');
    return true;
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
      onCustomExport={handleFullQuoteExport}
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
