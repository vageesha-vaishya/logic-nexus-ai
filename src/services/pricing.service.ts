
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createDebugLogger } from '@/lib/debug-logger';

export interface PricingRequest {
  service_id: string;
  quantity: number;
  currency?: string;
  customer_id?: string;
}

export interface PricingResult {
  unit_price: number;
  total_price: number;
  currency: string;
  pricing_model: 'flat' | 'tiered' | 'zone';
  applied_tier?: {
    min_quantity: number;
    max_quantity: number | null;
    unit_price: number;
  };
  warnings: string[];
}

export interface MarginRule {
  id: string;
  name: string;
  condition_json: Record<string, any>;
  adjustment_type: 'percent' | 'fixed';
  adjustment_value: number;
  priority: number;
}

/**
 * Enterprise Pricing Service
 * Handles complex pricing logic including Tiers, Zones, and Customer Contracts.
 */
export class PricingService {
  private supabase: SupabaseClient;
  private debug;
  private static cache = new Map<string, { data: any, timestamp: number }>();
  private static CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

  static clearCache() {
    PricingService.cache.clear();
  }

  /**
   * Fetch Active Margin Rules
   * Caches rules for 5 minutes.
   */
  async getMarginRules(): Promise<MarginRule[]> {
    const cacheKey = 'margin_rules';
    const now = Date.now();

    if (PricingService.cache.has(cacheKey)) {
      const entry = PricingService.cache.get(cacheKey)!;
      if (now - entry.timestamp < PricingService.CACHE_TTL) {
        return entry.data;
      }
    }

    const { data, error } = await this.supabase
      .from('margin_rules')
      .select('*')
      .order('priority', { ascending: false });

    if (error) {
      this.debug.error('Failed to fetch margin rules', error);
      return [];
    }

    const rules = data || [];
    PricingService.cache.set(cacheKey, { data: rules, timestamp: now });
    return rules;
  }

  /**
   * Resolve Applicable Margin Rules
   * Filters rules based on provided context matching condition_json.
   */
  async resolveMarginRules(context: Record<string, any>): Promise<MarginRule[]> {
    const rules = await this.getMarginRules();
    const applicableRules: MarginRule[] = [];

    for (const rule of rules) {
      let match = true;
      for (const [key, value] of Object.entries(rule.condition_json)) {
        // Simple equality check (can be expanded to support operators like 'gt', 'lt' in future)
        // If context doesn't have the key, we assume no match (or should we?)
        // Assuming strict match: context must have key and value must match.
        if (context[key] != value) {
          match = false;
          break;
        }
      }
      if (match) {
        applicableRules.push(rule);
      }
    }
    return applicableRules;
  }

  /**
   * Calculate Price with Dynamic Rules
   * Applies margin rules to a base cost to determine sell price.
   * Returns details about applied rules.
   */
  async calculatePriceWithRules(cost: number, context: Record<string, any>): Promise<{
    sellPrice: number;
    buyPrice: number;
    marginAmount: number;
    appliedRules: string[];
  }> {
    const rules = await this.resolveMarginRules(context);
    let sellPrice = cost;
    const appliedRuleNames: string[] = [];

    // Apply rules (priority ordered)
    // Logic: Rules add Markup to the Cost/Base
    for (const rule of rules) {
      if (rule.adjustment_type === 'percent') {
         // Percentage Markup on CURRENT accumulated price (compounding) or BASE cost?
         // Edge function implementation suggests compounding on the running price.
         sellPrice += sellPrice * (Number(rule.adjustment_value) / 100);
      } else if (rule.adjustment_type === 'fixed') {
         sellPrice += Number(rule.adjustment_value);
      }
      appliedRuleNames.push(rule.name);
    }
    
    const marginAmount = sellPrice - cost;

    return {
      sellPrice: Number(sellPrice.toFixed(2)),
      buyPrice: cost,
      marginAmount: Number(marginAmount.toFixed(2)),
      appliedRules: appliedRuleNames
    };
  }

  /**
   * Subscribe to Real-time Pricing Updates
   * Listens for changes in services and pricing tiers tables.
   * Clears cache and triggers callback on update.
   */
  subscribeToUpdates(onUpdate: () => void, onStatusChange?: (status: 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR') => void) {
    return this.supabase.channel('pricing_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, () => {
        PricingService.clearCache();
        onUpdate();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_pricing_tiers' }, () => {
        PricingService.clearCache();
        onUpdate();
      })
      .subscribe((status) => {
        if (onStatusChange) {
            onStatusChange(status as 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR');
        }
      });
  }

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
    this.debug = createDebugLogger('Service', 'Pricing');
  }

  /**
   * Calculate Price for a Service
   * Wraps the database RPC for performance but adds application-layer validation.
   * Includes automatic retry logic for network stability.
   */
  async calculatePrice(request: PricingRequest, retries = 3): Promise<PricingResult> {
    const { service_id, quantity, currency = 'USD' } = request;
    
    this.debug.info('Calculating price', { service_id, quantity, currency });

    // Helper for delay
    const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

    let lastError;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // 1. Call Database RPC (Preferred for performance)
        const { data: rpcResult, error } = await this.supabase
          .rpc('calculate_service_price', {
            p_service_id: service_id,
            p_quantity: quantity,
            p_currency: currency
          });

        if (error) throw error;

        if (rpcResult && rpcResult.length > 0) {
          // Return RPC result
          const res = rpcResult[0];
          return {
            unit_price: res.unit_price,
            total_price: res.total_price,
            currency: currency,
            pricing_model: res.pricing_model,
            applied_tier: res.applied_tier,
            warnings: []
          };
        }
        
        // If RPC returns empty but no error, it might be data issue, break to fallback
        break;

      } catch (err) {
        lastError = err;
        console.warn(`Pricing RPC attempt ${attempt + 1} failed:`, err);
        if (attempt < retries) {
          // Exponential backoff: 200ms, 400ms, 800ms
          await wait(200 * Math.pow(2, attempt));
          continue;
        }
      }
    }

    // 2. Fallback: Client-side Calculation (if RPC fails or logic is too complex for SQL)
    console.warn('RPC failed or returned no data after retries, falling back to client-side calculation', lastError);
    
    // Fetch Service & Tiers
    const { data: service } = await this.supabase
      .from('services')
      .select('base_price, pricing_config')
      .eq('id', service_id)
      .single();

    if (!service) throw new Error('Service not found');

    const { data: tiers } = await this.supabase
      .from('service_pricing_tiers')
      .select('*')
      .eq('service_id', service_id)
      .lte('min_quantity', quantity)
      .order('min_quantity', { ascending: false })
      .limit(1);

    let unitPrice = service.base_price;
    let appliedTier = undefined;

    // Apply Tier
    if (tiers && tiers.length > 0) {
      const tier = tiers[0];
      // Check max quantity if exists
      if (!tier.max_quantity || quantity <= tier.max_quantity) {
        unitPrice = tier.unit_price;
        appliedTier = tier;
      }
    }

    return {
      unit_price: unitPrice,
      total_price: unitPrice * quantity,
      currency: currency,
      pricing_model: service.pricing_config?.model || 'flat',
      applied_tier: appliedTier,
      warnings: ['Calculated client-side (RPC unavailable)']
    };
  }

  /**
   * Calculate Financials (Sell Price, Margin, etc.)
   * Replaces legacy client-side logic with a standardized service method.
   * Includes client-side caching (5-minute TTL) and simulated debounce.
   */
  async calculateFinancials(
    cost: number, 
    marginPercent: number, 
    isCostBased: boolean = true
  ): Promise<{ sellPrice: number; buyPrice: number; marginAmount: number; marginPercent: number }> {
    const cacheKey = `fin:${cost}:${marginPercent}:${isCostBased}`;
    const now = Date.now();

    // 1. Check Cache with TTL
    if (PricingService.cache.has(cacheKey)) {
      const entry = PricingService.cache.get(cacheKey)!;
      if (now - entry.timestamp < PricingService.CACHE_TTL) {
        return entry.data;
      } else {
        PricingService.cache.delete(cacheKey);
      }
    }

    // Removed artificial delay for production performance
    
    let sellPrice = 0;
    let buyPrice = 0;
    let marginAmount = 0;

    // Ensure valid inputs
    const safeCost = Number(cost) || 0;
    const safeMargin = Number(marginPercent) || 0;

    try {
      if (isCostBased) {
        // Cost-Plus Model: Sell = Cost / (1 - Margin%)
        buyPrice = safeCost;
        const divisor = 1 - (safeMargin / 100);
        sellPrice = divisor > 0 ? Number((buyPrice / divisor).toFixed(2)) : buyPrice;
        marginAmount = Number((sellPrice - buyPrice).toFixed(2));
      } else {
        // Sell-Based Model (Discount): Buy = Sell * (1 - Margin%)
        sellPrice = safeCost; // Here 'cost' argument is actually the Sell Price
        marginAmount = Number((sellPrice * (safeMargin / 100)).toFixed(2));
        buyPrice = Number((sellPrice - marginAmount).toFixed(2));
      }

      const result = {
        sellPrice,
        buyPrice,
        marginAmount,
        marginPercent: safeMargin
      };

      // 2. Set Cache
      PricingService.cache.set(cacheKey, { data: result, timestamp: now });

      return result;
    } catch (error) {
      console.error('Pricing calculation failed, falling back to safe defaults', error);
      return { sellPrice: safeCost, buyPrice: safeCost, marginAmount: 0, marginPercent: 0 };
    }
  }
}
