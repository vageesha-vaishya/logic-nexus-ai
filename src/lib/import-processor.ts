
import { cleanEmail, cleanUrl, cleanPhone, cleanAddress, CorrectionResult } from './data-cleaning';

export interface ImportLog {
  rowNumber: number;
  field: string;
  original: any;
  newValue: any;
  message: string;
  type: 'correction' | 'error' | 'info';
}

export interface ProcessedRow {
  data: Record<string, any>;
  logs: ImportLog[];
  isValid: boolean;
}

export const processImportRow = (
  row: Record<string, any>, 
  rowNumber: number,
  fieldMapping: Record<string, string> // key: dbField, value: csvColumn
): ProcessedRow => {
  const processedData: Record<string, any> = {};
  const logs: ImportLog[] = [];
  const isValid = true;

  // Invert mapping to iterate over DB fields we care about
  // actually we iterate over the mapping entries
  
  for (const [dbField, csvCol] of Object.entries(fieldMapping)) {
    const rawValue = row[csvCol];
    let result: CorrectionResult<any> = {
        value: rawValue,
        original: rawValue,
        corrected: false,
        isValid: true
    };

    const strValue = rawValue === null || rawValue === undefined ? '' : String(rawValue);

    // Apply cleaning based on DB field name
    // This is a heuristic. Ideally, we'd pass field types.
    if (dbField === 'email') {
        result = cleanEmail(strValue);
    } else if (dbField === 'website' || dbField === 'linkedin_url') {
        result = cleanUrl(strValue);
    } else if (dbField === 'phone' || dbField === 'mobile') {
        result = cleanPhone(strValue);
    } else if (
        dbField.includes('address') || dbField === 'city' || dbField === 'country' || dbField === 'state'
    ) {
        result = cleanAddress(strValue);
    }

    if (result.corrected) {
        logs.push({
            rowNumber,
            field: dbField,
            original: result.original,
            newValue: result.value,
            message: result.log || 'Auto-corrected',
            type: 'correction'
        });
    }

    if (!result.isValid) {
        // Requirement: "skip only invalid fields while preserving valid data"
        // So we keep the row valid but log the error?
        // But if a required field is invalid, the row might be invalid.
        // We don't know required fields here easily without schema.
        // Let's assume validationSchema in parent handles "required".
        // Here we just mark the field as null/invalid but don't fail the whole row unless critical?
        // Actually, if we set isValid = false, the row is skipped.
        // If we want partial import, we should set isValid = true but the specific field to null.
        
        // However, the requirement says "skip only invalid fields".
        // So we log the error, set value to null (or keep original?), and keep isValid = true.
        // Let's set value to null to avoid inserting bad data.
        
        processedData[dbField] = null; // Clear invalid data
        
        logs.push({
            rowNumber,
            field: dbField,
            original: result.original,
            newValue: null,
            message: result.log || 'Validation failed',
            type: 'error'
        });
        
        // We do NOT set isValid = false here, allowing partial import.
        // The parent component's validationSchema will catch missing required fields.
    } else {
        processedData[dbField] = result.value;
    }
  }

  // Handle unmapped fields if needed? 
  // For now, only mapped fields are processed.

  return {
    data: processedData,
    logs,
    isValid
  };
};
