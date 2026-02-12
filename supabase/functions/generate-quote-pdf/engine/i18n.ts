
import { QuoteTemplate } from "./schema.ts";

export class I18nEngine {
  private labels: Record<string, Record<string, string>> = {};
  private defaultLocale: string = "en-US";

  constructor(template?: QuoteTemplate) {
    if (template) {
      this.labels = template.i18n?.labels || {};
      this.defaultLocale = template.config.default_locale || "en-US";
    }
  }

  /**
   * Translates a key into the target locale.
   * Order of precedence:
   * 1. Template-specific translation for target locale
   * 2. Template-specific translation for default locale
   * 3. Key itself (fallback)
   */
  t(key: string, locale: string = this.defaultLocale): string {
    const keyLabels = this.labels[key];
    if (!keyLabels) return key;

    return keyLabels[locale] || keyLabels[this.defaultLocale] || key;
  }

  /**
   * Formats a number as currency.
   */
  formatCurrency(amount: number, currency: string, locale: string = this.defaultLocale): string {
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: currency,
      }).format(amount);
    } catch (e) {
      console.warn(`I18nEngine: Currency format failed for ${currency}`, e);
      return `${amount.toFixed(2)} ${currency}`;
    }
  }

  /**
   * Formats a date.
   */
  formatDate(dateStr: string, locale: string = this.defaultLocale): string {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      
      return new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(date);
    } catch (e) {
      console.warn(`I18nEngine: Date format failed for ${dateStr}`, e);
      return dateStr;
    }
  }
}
