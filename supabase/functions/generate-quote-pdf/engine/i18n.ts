
import { QuoteTemplate } from "./schema.ts";
import { Logger } from "../../_shared/logger.ts";

export class I18nEngine {
  private labels: Record<string, Record<string, string>> = {};
  private defaultLocale: string = "en-US";
  private logger: Logger | null = null;

  constructor(template?: QuoteTemplate, logger?: Logger) {
    if (template) {
      this.labels = template.i18n?.labels || {};
      this.defaultLocale = template.config.default_locale || "en-US";
    }
    this.logger = logger || null;
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
      if (this.logger) {
        this.logger.warn(`I18nEngine: Currency format failed for ${currency}`, { error: e });
      }
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
      if (this.logger) {
        this.logger.warn(`I18nEngine: Date format failed for ${dateStr}`, { error: e });
      }
      return dateStr;
    }
  }
}
