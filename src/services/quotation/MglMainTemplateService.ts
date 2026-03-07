import { invokeFunction } from '@/lib/supabase-functions';
import type { MglRateOption } from './mgl';
import { calculateMglRateOption, validateMglRateOption } from './mgl';

export interface MglTemplateRecord {
  id: string;
  tenant_id: string;
  quote_id?: string;
  quote_version_id?: string;
  template_name: string;
  config: Record<string, unknown>;
  is_active: boolean;
  updated_at: string;
}

export class MglMainTemplateService {
  static async listTemplates(tenantId: string, quoteId?: string) {
    const { data, error } = await invokeFunction<{ data: MglTemplateRecord[] }>('mgl-quotation-api', {
      body: {
        action: 'list_templates',
        tenantId,
        quoteId,
      },
    });

    if (error) throw error;
    return data?.data || [];
  }

  static async saveTemplate(payload: {
    tenantId: string;
    id?: string;
    quoteId?: string;
    quoteVersionId?: string;
    templateName?: string;
    config: Record<string, unknown>;
    isActive?: boolean;
  }) {
    const { data, error } = await invokeFunction<{ data: MglTemplateRecord }>('mgl-quotation-api', {
      body: {
        action: 'upsert_template',
        tenantId: payload.tenantId,
        payload: {
          id: payload.id,
          quoteId: payload.quoteId,
          quoteVersionId: payload.quoteVersionId,
          templateName: payload.templateName,
          config: payload.config,
          isActive: payload.isActive,
        },
      },
    });

    if (error) throw error;
    return data?.data;
  }

  static async upsertRateOption(tenantId: string, option: MglRateOption) {
    const validation = validateMglRateOption(option);
    if (!validation.valid) {
      throw new Error(validation.errors.map((e) => e.message).join('; '));
    }

    const { data, error } = await invokeFunction<{ data: any }>('mgl-quotation-api', {
      body: {
        action: 'upsert_rate_option',
        tenantId,
        quoteId: option.quoteId,
        quoteVersionId: option.quoteVersionId,
        payload: option,
      },
    });

    if (error) throw error;
    return data?.data;
  }

  static async deleteRateOption(tenantId: string, rateOptionId: string) {
    const { data, error } = await invokeFunction<{ success: boolean }>('mgl-quotation-api', {
      body: {
        action: 'delete_rate_option',
        tenantId,
        rateOptionId,
      },
    });

    if (error) throw error;
    return Boolean(data?.success);
  }

  static async getRateOption(tenantId: string, rateOptionId: string) {
    const { data, error } = await invokeFunction<{ data: any }>('mgl-quotation-api', {
      body: {
        action: 'get_rate_option',
        tenantId,
        rateOptionId,
      },
    });

    if (error) throw error;
    return data?.data;
  }

  static async getRateHistory(tenantId: string, rateOptionId: string) {
    const { data, error } = await invokeFunction<{ data: any[] }>('mgl-quotation-api', {
      body: {
        action: 'list_rate_history',
        tenantId,
        rateOptionId,
      },
    });

    if (error) throw error;
    return data?.data || [];
  }

  static calculate(option: MglRateOption) {
    return calculateMglRateOption(option);
  }
}
