import { IQuotationEngine } from '../quotation/IQuotationEngine';

export interface IPlugin {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly domainCode: string; // e.g., 'LOGISTICS'

  /**
   * The quotation engine provided by this plugin.
   */
  getQuotationEngine(): IQuotationEngine;

  /**
   * Returns the configuration for the dynamic form renderer.
   * This allows the plugin to define how the quote form looks.
   */
  getFormConfig(): PluginFormConfig;
}

export interface PluginFormConfig {
  sections: FormSection[];
}

export interface FormSection {
  id: string;
  title: string;
  fields: FormField[];
}

export interface FormField {
  id: string;
  type: 'text' | 'number' | 'select' | 'date' | 'checkbox' | 'complex' | 'location';
  label: string;
  required?: boolean;
  options?: { label: string; value: any }[]; // For select
  defaultValue?: any;
  validation?: any; // Zod schema or similar
  hidden?: boolean;
}
