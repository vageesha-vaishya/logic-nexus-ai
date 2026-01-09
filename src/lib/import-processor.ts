
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
  let isValid = true;

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

    // Apply cleaning based on DB field name
    // This is a heuristic. Ideally, we'd pass field types.
    if (dbField === 'email' && typeof rawValue === 'string') {
        result = cleanEmail(rawValue);
    } else if ((dbField === 'website' || dbField === 'linkedin_url') && typeof rawValue === 'string') {
        result = cleanUrl(rawValue);
    } else if ((dbField === 'phone' || dbField === 'mobile') && typeof rawValue === 'string') {
        result = cleanPhone(rawValue);
    } else if (
        (dbField.includes('address') || dbField === 'city' || dbField === 'country' || dbField === 'state') 
        && typeof rawValue === 'string'
    ) {
        result = cleanAddress(rawValue);
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
        // Depending on strictness, we might flag the row as invalid
        // But for "robust" import, maybe we just log it as an error but keep the value?
        // Requirement: "Preserves original data when automatic correction isn't possible"
        logs.push({
            rowNumber,
            field: dbField,
            original: result.original,
            newValue: result.value,
            message: result.log || 'Validation failed',
            type: 'error'
        });
        isValid = false; // Mark row as invalid if validation fails
    }

    processedData[dbField] = result.value;
  }

  // Handle unmapped fields if needed? 
  // For now, only mapped fields are processed.

  return {
    data: processedData,
    logs,
    isValid
  };
};
