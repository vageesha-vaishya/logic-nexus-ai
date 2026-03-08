
import { describe, it, expect } from 'vitest';
import { I18nEngine } from '../engine/i18n';
import { QuoteTemplate } from '../engine/schema';

describe('I18nEngine', () => {
  it('should default to en-US when config is missing', () => {
    const template = {} as QuoteTemplate;
    const i18n = new I18nEngine(template);
    // @ts-ignore - accessing private property for testing
    expect(i18n.defaultLocale).toBe('en-US');
  });

  it('should default to en-US when default_locale is missing', () => {
    const template = { config: {} } as QuoteTemplate;
    const i18n = new I18nEngine(template);
    // @ts-ignore
    expect(i18n.defaultLocale).toBe('en-US');
  });

  it('should use provided default_locale', () => {
    const template = { config: { default_locale: 'es-ES' } } as any;
    const i18n = new I18nEngine(template);
    // @ts-ignore
    expect(i18n.defaultLocale).toBe('es-ES');
  });

  it('should fallback to default locale if translation missing', () => {
    const template = {
      config: { default_locale: 'en-US' },
      i18n: {
        labels: {
          'hello': {
            'en-US': 'Hello',
            'es-ES': 'Hola'
          }
        }
      }
    } as any;
    const i18n = new I18nEngine(template);
    
    expect(i18n.t('hello', 'fr-FR')).toBe('Hello'); // Fallback to en-US
  });

  it('should return key if no translation found', () => {
    const template = { config: { default_locale: 'en-US' } } as any;
    const i18n = new I18nEngine(template);
    
    expect(i18n.t('unknown_key')).toBe('unknown_key');
  });
});
