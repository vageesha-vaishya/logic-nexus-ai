import { vi } from 'vitest';

Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
  value: vi.fn(),
  writable: true,
});

Object.defineProperty(URL, 'createObjectURL', {
  value: vi.fn(() => 'blob:url'),
  writable: true,
});
