import { describe, it, expect } from 'vitest';
import { cleanEmail, cleanUrl, cleanPhone, cleanAddress } from './data-cleaning';

describe('Data Cleaning', () => {
  describe('cleanEmail', () => {
    it('should correct common typos', () => {
      expect(cleanEmail('test@gmil.com').value).toBe('test@gmail.com');
      expect(cleanEmail('test@hotmial.com').value).toBe('test@hotmail.com');
    });
    
    it('should return null for invalid emails', () => {
      expect(cleanEmail('not-an-email').value).toBeNull();
      expect(cleanEmail('test@').value).toBeNull();
    });

    it('should normalize case and trim', () => {
      expect(cleanEmail('  Test@Gmail.com  ').value).toBe('test@gmail.com');
    });

    it('should return null for empty input', () => {
        expect(cleanEmail('').value).toBeNull();
        expect(cleanEmail(null as any).value).toBeNull();
    });
  });

  describe('cleanUrl', () => {
    it('should add protocol if missing', () => {
      expect(cleanUrl('example.com').value).toBe('https://example.com');
      expect(cleanUrl('www.example.com').value).toBe('https://www.example.com');
    });

    it('should keep existing protocol', () => {
      expect(cleanUrl('http://example.com').value).toBe('http://example.com');
    });

    it('should return null for invalid URLs', () => {
        expect(cleanUrl('not a url').value).toBeNull();
    });

    it('should return null for empty input', () => {
        expect(cleanUrl('').value).toBeNull();
    });
  });

  describe('cleanPhone', () => {
    it('should normalize phone numbers', () => {
        const result = cleanPhone('+1 (555) 123-4567');
        expect(result.value).toBe('+15551234567');
    });

    it('should handle digits only', () => {
        const result = cleanPhone('5551234567');
        expect(result.value).toBe('+15551234567'); // Defaulting to US +1 in our logic
    });
    
    it('should return null for invalid phone', () => {
        expect(cleanPhone('abc').value).toBeNull();
    });
  });
});
