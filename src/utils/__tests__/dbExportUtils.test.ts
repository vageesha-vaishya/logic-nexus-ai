
import { describe, it, expect } from 'vitest';
import { validateSQL, resolveDataTypeForValue, formatValue } from '../dbExportUtils';

describe('dbExportUtils', () => {
  describe('validateSQL', () => {
    it('should detect unclosed single quotes', () => {
      const sql = "INSERT INTO table VALUES ('unclosed string)";
      const errors = validateSQL(sql, 'Test');
      expect(errors).toContain('[Test] Potentially unclosed single quote');
    });

    it('should detect unclosed double quotes', () => {
      const sql = 'CREATE TABLE "unclosed_identifier (id int)';
      const errors = validateSQL(sql, 'Test');
      expect(errors).toContain('[Test] Potentially unclosed double quote');
    });

    it('should detect DROP DATABASE', () => {
      const sql = 'DROP DATABASE production;';
      const errors = validateSQL(sql, 'Test');
      expect(errors).toContain('[Test] Contains DROP DATABASE statement');
    });

    it('should detect TRUNCATE', () => {
      const sql = 'TRUNCATE TABLE users;';
      const errors = validateSQL(sql, 'Test');
      expect(errors).toContain('[Test] Contains TRUNCATE statement');
    });

    it('should detect null bytes', () => {
      const sql = 'INSERT INTO logs VALUES ("bad\u0000char");';
      const errors = validateSQL(sql, 'Test');
      expect(errors).toContain('[Test] Contains null byte characters');
    });

    it('should check for reserved words in Table context', () => {
      const sql = 'CREATE TABLE User (id int);'; // User is reserved
      const errors = validateSQL(sql, 'Tables', true);
      expect(errors).toContain('[Tables] Potentially unquoted reserved word used: USER');
    });
  });

  describe('resolveDataTypeForValue', () => {
    it('should handle standard types', () => {
      expect(resolveDataTypeForValue({ data_type: 'integer' })).toBe('integer');
      expect(resolveDataTypeForValue({ data_type: 'text' })).toBe('text');
    });

    it('should handle arrays', () => {
      expect(resolveDataTypeForValue({ data_type: 'ARRAY', udt_name: '_text' })).toBe('text[]');
      expect(resolveDataTypeForValue({ data_type: 'ARRAY', udt_name: '_int4' })).toBe('int4[]');
    });

    it('should handle user-defined types', () => {
      expect(resolveDataTypeForValue({ data_type: 'USER-DEFINED', udt_name: 'my_enum' })).toBe('my_enum');
    });
  });

  describe('formatValue', () => {
    it('should format null/undefined', () => {
      expect(formatValue(null)).toBe('NULL');
      expect(formatValue(undefined)).toBe('NULL');
    });

    it('should format strings with escaping', () => {
      expect(formatValue("simple")).toBe("'simple'");
      expect(formatValue("O'Reilly")).toBe("'O''Reilly'");
    });

    it('should format numbers', () => {
      expect(formatValue(123)).toBe('123');
      expect(formatValue(12.34)).toBe('12.34');
      expect(formatValue(NaN)).toBe('NULL');
    });

    it('should format booleans', () => {
      expect(formatValue(true)).toBe('TRUE');
      expect(formatValue(false)).toBe('FALSE');
    });

    it('should format dates', () => {
      const date = new Date('2023-01-01T00:00:00.000Z');
      expect(formatValue(date)).toBe("'2023-01-01T00:00:00.000Z'");
    });

    it('should format arrays', () => {
      expect(formatValue([1, 2], 'integer[]')).toBe("'{1,2}'::integer[]");
      expect(formatValue(['a', 'b'], 'text[]')).toBe("'{\"a\",\"b\"}'::text[]");
    });

    it('should format JSON', () => {
      const obj = { key: "value" };
      expect(formatValue(obj, 'jsonb')).toBe('\'{"key":"value"}\'::jsonb');
      // Fallback object handling
      expect(formatValue(obj)).toBe('\'{"key":"value"}\'');
    });
  });
});
