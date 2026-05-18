// src/features/markets/retail/community/i18n.test.ts
import { describe, it, expect } from 'vitest';

describe('community locale files', () => {
  it('en/community.json has required keys', async () => {
    const en = await import('../../../../../public/locales/en/community.json');
    expect(en.default).toHaveProperty('baskets.title');
    expect(en.default).toHaveProperty('baskets.invest');
    expect(en.default).toHaveProperty('strategies.title');
    expect(en.default).toHaveProperty('strategies.deploy');
    expect(en.default).toHaveProperty('copy.title');
    expect(en.default).toHaveProperty('copy.safety_notice');
  });

  it('hi/community.json has same top-level sections as en', async () => {
    const en = await import('../../../../../public/locales/en/community.json');
    const hi = await import('../../../../../public/locales/hi/community.json');
    const enSections = Object.keys(en.default);
    const hiSections = Object.keys(hi.default);
    expect(hiSections).toEqual(expect.arrayContaining(enSections));
  });
});
