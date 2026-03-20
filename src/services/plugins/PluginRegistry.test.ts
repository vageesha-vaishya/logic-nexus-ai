import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PluginRegistry } from './PluginRegistry';

vi.mock('../quotation/CoreQuoteService', () => ({
  CoreQuoteService: {
    registerEngine: vi.fn(),
  },
}));

describe('PluginRegistry', () => {
  beforeEach(() => {
    PluginRegistry.clear();
  });

  it('matches plugin by domain code case-insensitively', () => {
    const plugin = {
      id: 'plugin-logistics',
      name: 'Logistics',
      version: '1.0.0',
      domainCode: 'LOGISTICS',
      getQuotationEngine: vi.fn(),
      getFormConfig: vi.fn(() => ({
        sections: [
          {
            id: 'section-1',
            title: 'Section',
            fields: [],
          },
        ],
      })),
    };
    PluginRegistry.register(plugin as any);

    expect(PluginRegistry.getPluginByDomain('logistics')).toBe(plugin);
  });

  it('returns form config by domain', () => {
    const plugin = {
      id: 'plugin-banking',
      name: 'Banking',
      version: '1.0.0',
      domainCode: 'BANKING',
      getQuotationEngine: vi.fn(),
      getFormConfig: vi.fn(() => ({
        sections: [
          {
            id: 'loan',
            title: 'Loan',
            fields: [],
          },
        ],
      })),
    };
    PluginRegistry.register(plugin as any);

    const config = PluginRegistry.getFormConfigByDomain('banking');

    expect(config?.sections[0].id).toBe('loan');
  });
});
