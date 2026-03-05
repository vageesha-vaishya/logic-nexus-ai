import { describe, it, expect } from 'vitest';
import { getSafeName } from '../utils';

describe('utils', () => {
  describe('getSafeName', () => {
    it('returns the string itself if input is a string', () => {
      expect(getSafeName('test')).toBe('test');
    });

    it('returns stringified number if input is a number', () => {
      expect(getSafeName(123)).toBe('123');
    });

    it('returns fallback if input is null', () => {
      expect(getSafeName(null, 'fallback')).toBe('fallback');
    });

    it('returns fallback if input is undefined', () => {
      expect(getSafeName(undefined, 'fallback')).toBe('fallback');
    });

    it('returns empty string if input is null/undefined and no fallback provided', () => {
      expect(getSafeName(null)).toBe('');
      expect(getSafeName(undefined)).toBe('');
    });

    it('returns name property from object', () => {
      expect(getSafeName({ name: 'test name' })).toBe('test name');
    });

    it('returns code property from object if name is missing', () => {
      expect(getSafeName({ code: 'test code' })).toBe('test code');
    });

    it('returns details property from object if name/code are missing', () => {
      expect(getSafeName({ details: 'test details' })).toBe('test details');
    });

    it('returns description property from object if others are missing', () => {
      expect(getSafeName({ description: 'test description' })).toBe('test description');
    });

    it('returns fallback if object has no relevant properties', () => {
      expect(getSafeName({ foo: 'bar' }, 'fallback')).toBe('fallback');
    });
  });
});
