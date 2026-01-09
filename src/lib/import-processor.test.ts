import { describe, it, expect } from 'vitest';
import { processImportRow } from './import-processor';

describe('Import Processor', () => {
    it('should map fields correctly', () => {
        const row = { 'Name': 'Test Corp', 'Email Address': 'test@example.com' };
        const mapping = { 'name': 'Name', 'email': 'Email Address' };
        
        const result = processImportRow(row, 1, mapping);
        
        expect(result.data.name).toBe('Test Corp');
        expect(result.data.email).toBe('test@example.com');
        expect(result.isValid).toBe(true);
    });

    it('should apply auto-correction for emails', () => {
        const row = { 'Email': 'test@gmil.com' };
        const mapping = { 'email': 'Email' };
        
        const result = processImportRow(row, 1, mapping);
        
        expect(result.data.email).toBe('test@gmail.com');
        expect(result.logs).toHaveLength(1);
        expect(result.logs[0].type).toBe('correction');
        expect(result.logs[0].field).toBe('email');
    });

    it('should log errors for invalid critical fields', () => {
        const row = { 'Email': 'not-an-email' };
        const mapping = { 'email': 'Email' };
        
        const result = processImportRow(row, 1, mapping);
        
        expect(result.data.email).toBeNull();
        expect(result.isValid).toBe(false);
        expect(result.logs).toHaveLength(1);
        expect(result.logs[0].type).toBe('error');
    });

    it('should handle unmapped fields', () => {
        const row = { 'Name': 'Test', 'Extra': 'Value' };
        const mapping = { 'name': 'Name' };
        
        const result = processImportRow(row, 1, mapping);
        
        expect(result.data.name).toBe('Test');
        expect(result.data.Extra).toBeUndefined();
    });
});
