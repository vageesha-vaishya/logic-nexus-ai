
// Utility functions for Database Export

/**
 * Validates SQL content for common issues and potential dangers.
 * @param sql The SQL string to validate
 * @param context The context/section name for error reporting
 * @param validateReservedWords Whether to check for reserved word conflicts
 * @returns Array of error/warning messages
 */
export const validateSQL = (sql: string, context: string, validateReservedWords: boolean = true) => {
    const errors: string[] = [];
    if (!sql.trim()) return errors;
    
    // Check for common issues
    const openQuotes = (sql.match(/'/g) || []).length;
    if (openQuotes % 2 !== 0) errors.push(`[${context}] Potentially unclosed single quote`);
    
    const openDoubleQuotes = (sql.match(/"/g) || []).length;
    if (openDoubleQuotes % 2 !== 0) errors.push(`[${context}] Potentially unclosed double quote`);
    
    // Helper: strip single-quoted literals to avoid false positives
    const stripSingleQuotedLiterals = (s: string) => s.replace(/'(?:''|[^'])*'/g, "''");
    const dangerScan = stripSingleQuotedLiterals(sql).toUpperCase();
    
    // Check for potentially dangerous operations in export
    if (dangerScan.includes('DROP DATABASE')) errors.push(`[${context}] Contains DROP DATABASE statement`);
    if (dangerScan.includes('TRUNCATE')) errors.push(`[${context}] Contains TRUNCATE statement`);
    if (sql.includes('\u0000')) errors.push(`[${context}] Contains null byte characters`);

    // Reserved Word Check
    if (validateReservedWords && context === 'Tables') {
        // Focus on identifiers commonly used as names, avoid core SQL keywords
        const candidates = ['USER', 'ORDER', 'GROUP', 'LIMIT', 'OFFSET'];
        const unquotedSql = sql.replace(/"[^"]*"/g, '""'); // remove double-quoted identifiers from consideration
        candidates.forEach(word => {
            let pattern: RegExp;
            if (word === 'ORDER') {
                // Ignore ORDER BY keyword
                pattern = /\bORDER\b(?!\s+BY)/i;
            } else if (word === 'GROUP') {
                // Ignore GROUP BY keyword
                pattern = /\bGROUP\b(?!\s+BY)/i;
            } else {
                pattern = new RegExp(`\\b${word}\\b`, 'i');
            }
            if (pattern.test(unquotedSql)) {
                errors.push(`[${context}] Potentially unquoted reserved word used: ${word}`);
            }
        });
    }
    
    return errors;
};

export const escapeStr = (s: string) => s.replace(/'/g, "''");

export const formatArray = (arr: any[], baseType?: string): string => {
    const numericTypes = ["integer", "bigint", "smallint", "numeric", "real", "double precision"];
    const items = arr.map((v) => {
        if (v === null) return "NULL";
        if (baseType && numericTypes.includes(baseType)) return String(v);
        if (baseType === "boolean") return v ? "true" : "false";
        const s = String(v).replace(/"/g, '\\"').replace(/\\/g, "\\\\").replace(/'/g, "''");
        return `"${s}"`;
    }).join(",");
    const literal = `{${items}}`;
    return baseType ? `'${literal}'::${baseType}[]` : `'${literal}'`;
};

export const formatValue = (value: any, dataType?: string) => {
    if (value === undefined || value === null) return "NULL";
    
    if (dataType === "json" || dataType === "jsonb") {
        const json = JSON.stringify(value);
        return `'${escapeStr(json)}'::${dataType}`;
    }
    
    if (dataType && dataType.endsWith("[]") && Array.isArray(value)) {
        return formatArray(value, dataType.slice(0, -2));
    }
    
    if (typeof value === "string") return `'${escapeStr(value)}'`;
    if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
    if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
    if (value instanceof Date) return `'${value.toISOString()}'`;
    
    if (typeof value === "object") {
        const json = JSON.stringify(value);
        return `'${escapeStr(json)}'`;
    }
    
    return `'${escapeStr(String(value))}'`;
};

export const resolveDataTypeForValue = (col: any) => {
    const dt = (col.data_type || '').toString();
    const udt = (col.udt_name || '').toString();
    if (dt.toUpperCase() === 'ARRAY' && udt) {
        const base = udt.startsWith('_') ? udt.slice(1) : udt;
        return `${base}[]`;
    }
    if (dt.toUpperCase() === 'USER-DEFINED' && udt) {
        return udt;
    }
    return dt;
};

/**
 * Calculates a simple checksum (CRC32-like or hash) for data integrity verification.
 * @param data The string data to hash
 * @returns A hex string representation of the hash
 */
export const calculateChecksum = (data: string): string => {
    let hash = 0;
    if (data.length === 0) return '0';
    for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
    }
    return (hash >>> 0).toString(16); // Unsigned hex
};

/**
 * Generates a manifest object for the export.
 */
export const generateManifest = (
    tables: { name: string; rowCount: number; checksum: string; schemaSignature?: string }[],
    totalRows: number,
    status: 'success' | 'partial' | 'failed',
    errors: string[]
) => {
    return {
        version: '1.0',
        timestamp: new Date().toISOString(),
        status,
        summary: {
            total_tables: tables.length,
            total_rows: totalRows,
            integrity_check: errors.length === 0 ? 'PASSED' : 'FAILED'
        },
        tables: tables.reduce((acc, t) => ({
            ...acc,
            [t.name]: {
                rows: t.rowCount,
                checksum: t.checksum,
                schema_signature: t.schemaSignature
            }
        }), {}),
        errors
    };
};

export type ExportStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error' | 'cancelled';

export interface LogEntry {
  timestamp: number;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
}

export interface DetailedProgress {
  status: ExportStatus;
  percent: number;
  message: string;
  currentStep: string;
  currentItem: string;
  processedItems: number;
  totalItems: number;
  startTime: number;
  estimatedTimeRemaining: number | null; // seconds
  logs: LogEntry[];
  errors: string[];
}

/**
 * Calculates a signature for the table schema to detect changes.
 * @param columns Array of column definitions
 * @returns Hash string of the schema signature
 */
export const calculateSchemaSignature = (columns: any[]) => {
  const sorted = [...columns].sort((a, b) => a.column_name.localeCompare(b.column_name));
  const signatureString = sorted.map(c => 
      `${c.column_name}:${c.data_type}:${c.is_nullable === true || c.is_nullable === 'YES'}:${c.is_primary_key}`
  ).join('|');
  return calculateChecksum(signatureString);
};
