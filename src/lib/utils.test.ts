import { describe, it, expect } from 'vitest';
import { cn, matchText } from './utils';

describe('utils', () => {
  describe('cn', () => {
    it('should merge class names correctly', () => {
      expect(cn('bg-red-500', 'text-white')).toBe('bg-red-500 text-white');
    });

    it('should handle conditional classes', () => {
      expect(cn('bg-red-500', false && 'text-white', 'p-4')).toBe('bg-red-500 p-4');
    });

    it('should resolve tailwind conflicts', () => {
      expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
    });
  });

  describe('matchText', () => {
    it('should match contains by default', () => {
      expect(matchText('Hello World', 'World')).toBe(true);
      expect(matchText('Hello World', 'Foo')).toBe(false);
    });

    it('should match equals', () => {
      expect(matchText('Hello', 'hello', 'equals')).toBe(true);
      expect(matchText('Hello', 'Hello World', 'equals')).toBe(false);
    });

    it('should match startsWith', () => {
      expect(matchText('Hello World', 'Hell', 'startsWith')).toBe(true);
      expect(matchText('Hello World', 'World', 'startsWith')).toBe(false);
    });

    it('should match endsWith', () => {
      expect(matchText('Hello World', 'World', 'endsWith')).toBe(true);
      expect(matchText('Hello World', 'Hello', 'endsWith')).toBe(false);
    });

    it('should handle null/undefined values', () => {
      expect(matchText(null, 'foo')).toBe(false);
      expect(matchText(undefined, 'foo')).toBe(false);
    });

    it('should return true for empty query', () => {
      expect(matchText('Hello', '')).toBe(true);
    });
  });
});
