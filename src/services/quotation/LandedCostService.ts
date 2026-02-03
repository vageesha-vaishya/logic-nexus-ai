
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface LandedCostItem {
  hs_code: string;
  value: number;
  quantity: number;
  weight?: number;
  origin_country?: string;
}

export interface LandedCostResult {
  items: {
    hs_code: string;
    duty_amount: number;
    rate_found: boolean;
    rate_details: any;
  }[];
  summary: {
    total_value: number;
    total_duty: number;
    total_fees: number;
    estimated_mpf: number;
    estimated_hmf: number;
    grand_total_estimated_landed_cost: number;
  };
}

export const LandedCostService = {
  async calculate(items: LandedCostItem[], destinationCountry: string = 'US'): Promise<LandedCostResult | null> {
    try {
      const { data, error } = await supabase.rpc('calculate_landed_cost', {
        items: items as any, // Supabase expects JSONB, cast as any to bypass strict type check if needed or define proper Json type
        destination_country: destinationCountry
      });

      if (error) {
        logger.error('Failed to calculate landed cost', { error, component: 'LandedCostService' });
        throw error;
      }

      return data as LandedCostResult;
    } catch (err) {
      logger.error('Error in calculate landed cost service', { error: err, component: 'LandedCostService' });
      return null;
    }
  }
};
