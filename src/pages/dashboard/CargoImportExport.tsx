import { supabase } from '@/integrations/supabase/client';
import DataImportExport, { DataField, ExportTemplate } from '@/components/system/DataImportExport';
import * as z from 'zod';

const cargoFields: DataField[] = [
  { key: 'commodity_description', label: 'Description', required: true },
  { key: 'package_count', label: 'Package Count', type: 'number' },
  { key: 'total_weight_kg', label: 'Total Weight (kg)', type: 'number' },
  { key: 'total_volume_cbm', label: 'Total Volume (cbm)', type: 'number' },
  { key: 'hazmat', label: 'Hazmat', type: 'boolean' },
  { key: 'hazmat_class', label: 'Hazmat Class' },
  { key: 'temperature_controlled', label: 'Temp Controlled', type: 'boolean' },
  { key: 'aes_hts_id', label: 'HTS Code' },
];

const cargoExportFields: DataField[] = [
  { key: 'id', label: 'ID' },
  { key: 'created_at', label: 'Created At', type: 'date' },
  { key: 'updated_at', label: 'Updated At', type: 'date' },
  ...cargoFields
];

const cargoSchema = z.object({
  commodity_description: z.string().min(1, 'Description is required'),
  package_count: z.coerce.number().min(0).optional(),
  total_weight_kg: z.coerce.number().min(0).optional(),
  total_volume_cbm: z.coerce.number().min(0).optional(),
  hazmat: z.boolean().optional(),
  hazmat_class: z.string().optional(),
  temperature_controlled: z.boolean().optional(),
  aes_hts_id: z.string().uuid().optional().or(z.literal('')).or(z.null()),
});

const defaultTemplate: ExportTemplate = {
  name: 'Standard',
  fields: ['commodity_description', 'package_count', 'total_weight_kg', 'aes_hts_id', 'hazmat'],
  includeCustomFields: true,
};

export default function CargoImportExport() {
  const prepareExportData = async (data: any[]) => {
    // Collect all aes_hts_ids
    const htsIds = [...new Set(data.map(d => d.aes_hts_id).filter(Boolean))];
    
    if (htsIds.length === 0) return data;

    // Fetch codes
    const { data: htsCodes } = await supabase
      .from('aes_hts_codes')
      .select('id, hts_code, description')
      .in('id', htsIds);
      
    const htsMap = new Map(htsCodes?.map((h: any) => [h.id, h]) || []);

    return data.map(row => {
      const hts = row.aes_hts_id ? htsMap.get(row.aes_hts_id) : null;
      return {
        ...row,
        // Replace UUID with code string for export
        aes_hts_id: hts ? `${hts.hts_code} (${hts.description})` : row.aes_hts_id
      };
    });
  };

  const prepareImportBatch = async (batch: any[]) => {
    // Collect all aes_hts_id values that are NOT UUIDs (assuming they are codes)
    const codeMap = new Map<string, string>(); // code -> id
    const codesToFetch = new Set<string>();

    batch.forEach(row => {
      const val = row.aes_hts_id;
      // Simple check for UUID format
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val || '');
      
      if (val && typeof val === 'string' && !isUuid) {
        // It's a code, not a UUID
        // Try to extract code from "Code (Description)" format
        let code = val.trim();
        const match = code.match(/^([\d.]+)/);
        if (match) {
            code = match[1];
        }
        codesToFetch.add(code);
      }
    });

    if (codesToFetch.size > 0) {
      const { data } = await supabase
        .from('aes_hts_codes')
        .select('id, hts_code')
        .in('hts_code', Array.from(codesToFetch));
      
      data?.forEach((d: any) => {
        codeMap.set(d.hts_code, d.id);
      });
    }

    return batch.map(row => {
      const val = row.aes_hts_id;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val || '');

      if (val && typeof val === 'string' && !isUuid) {
         let code = val.trim();
         const match = code.match(/^([\d.]+)/);
         if (match) code = match[1];

         const resolvedId = codeMap.get(code);
         // If resolved, replace. If not, set to null (invalid code)
         return {
           ...row,
           aes_hts_id: resolvedId || null
         };
      }
      return row;
    });
  };

  return (
    <DataImportExport
      entityName="Cargo"
      tableName="cargo_details"
      fields={cargoFields}
      exportFields={cargoExportFields}
      validationSchema={cargoSchema}
      defaultExportTemplate={defaultTemplate}
      listPath="/dashboard/cargo-details"
      onPrepareExportData={prepareExportData}
      onPrepareImportBatch={prepareImportBatch}
    />
  );
}
