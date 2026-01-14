import { calculateChecksum, generateManifest } from '../dbExportUtils';

describe('Database Export Verification Utils', () => {
    describe('calculateChecksum', () => {
        it('should return consistent checksum for same data', () => {
            const data = '{"id":1,"name":"test"}';
            const sum1 = calculateChecksum(data);
            const sum2 = calculateChecksum(data);
            expect(sum1).toBe(sum2);
        });

        it('should return different checksum for different data', () => {
            const sum1 = calculateChecksum('{"id":1}');
            const sum2 = calculateChecksum('{"id":2}');
            expect(sum1).not.toBe(sum2);
        });

        it('should handle empty string', () => {
            expect(calculateChecksum('')).toBe('0');
        });
        
        it('should handle large data strings', () => {
            const largeData = 'a'.repeat(10000);
            const sum = calculateChecksum(largeData);
            expect(sum).toBeDefined();
            expect(sum.length).toBeGreaterThan(0);
        });
    });

    describe('generateManifest', () => {
        it('should generate correct manifest structure', () => {
            const tables = [
                { name: 'users', rowCount: 100, checksum: 'abc' },
                { name: 'orders', rowCount: 500, checksum: 'def' }
            ];
            const manifest = generateManifest(tables, 600, 'success', []);
            
            expect(manifest.version).toBe('1.0');
            expect(manifest.status).toBe('success');
            expect(manifest.summary.total_tables).toBe(2);
            expect(manifest.summary.total_rows).toBe(600);
            expect(manifest.summary.integrity_check).toBe('PASSED');
            expect(manifest.tables['users'].rows).toBe(100);
            expect(manifest.tables['users'].checksum).toBe('abc');
            expect(manifest.errors).toHaveLength(0);
        });

        it('should report failure status and errors', () => {
            const manifest = generateManifest([], 0, 'partial', ['Error 1']);
            expect(manifest.status).toBe('partial');
            expect(manifest.summary.integrity_check).toBe('FAILED');
            expect(manifest.errors).toContain('Error 1');
        });
    });
});
