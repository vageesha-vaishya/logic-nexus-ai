
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { QuoteOptionService } from '../../services/QuoteOptionService';

// Polyfill for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials in .env');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const quoteOptionService = new QuoteOptionService(supabase as any);

describe('Smart Quote Integration (Service Layer)', () => {
  let tenantId: string;
  let quoteId: string;
  let versionId: string;
  let currencyId: string;

  beforeAll(async () => {
    // 1. Get Tenant
    const { data: tenant } = await supabase.from('tenants').select('id').limit(1).single();
    if (!tenant) throw new Error('No tenant found');
    tenantId = tenant.id;

    // 1b. Get Currency
    const { data: currency } = await supabase.from('currencies').select('id').eq('code', 'USD').maybeSingle();
    // Fallback if USD not found, get any currency
    if (currency) {
        currencyId = currency.id;
    } else {
        const { data: anyCurr } = await supabase.from('currencies').select('id').limit(1).single();
        if (!anyCurr) throw new Error('No currency found');
        currencyId = anyCurr.id;
    }

    // 2. Create Quote
    const { data: quote } = await supabase.from('quotes').insert({
      tenant_id: tenantId,
      title: 'Smart Quote Integration Test',
      transport_mode: 'AIR',
      origin_code: 'JFK',
      destination_code: 'LHR',
      status: 'draft'
    }).select().single();
    if (!quote) throw new Error('Failed to create quote');
    quoteId = quote.id;

    // 3. Create Version
    const { data: version } = await supabase.from('quotation_versions').insert({
      quote_id: quoteId,
      tenant_id: tenantId,
      version_number: 1
    }).select().single();
    if (!version) throw new Error('Failed to create version');
    versionId = version.id;
  });

  afterAll(async () => {
    if (quoteId) {
      await supabase.from('quotes').delete().eq('id', quoteId);
    }
  });

  it('should persist AI-generated quote options with correct attribution', async () => {
    // Simulate AI Advisor Response
    const mockAiRate = {
      carrier: { name: 'AI Air Lines', id: 'carrier-ai-123' },
      price: 1500.00,
      currency: 'USD',
      transit_time: '12 hours',
      service_type: 'Express',
      reliability_score: 0.95,
      ai_explanation: 'Based on historical data and current market rates.',
      source_attribution: 'AI Smart Engine',
      legs: [
        {
          origin: 'JFK',
          destination: 'LHR',
          mode: 'AIR',
          carrier: 'AI Air Lines'
        }
      ],
      charges: [
        { name: 'Air Freight', amount: 1200, currency: 'USD', category: 'Freight' },
        { name: 'Fuel Surcharge', amount: 200, currency: 'USD', category: 'Surcharge' },
        { name: 'Security Fee', amount: 100, currency: 'USD', category: 'Fee' }
      ]
    };

    // Mock Rate Mapper
    const mockRateMapper = {
      getCurrId: (code: string) => currencyId,
      getServiceTypeId: (mode: string, tier: string) => null,
      getModeId: (mode: string) => null,
      getPortId: (code: string) => null,
      getProviderId: (name: string) => null,
      getSideId: (side: string) => side === 'buy' || side === 'cost' ? 'buy-side-id' : 'sell-side-id',
      getCatId: (key: string) => 'cat-id', // Mock category ID
      getBasisId: (code: string) => 'basis-id', // Mock basis ID
    };

    // Call Service
    const optionId = await quoteOptionService.addOptionToVersion({
      tenantId,
      versionId,
      rate: mockAiRate,
      rateMapper: mockRateMapper,
      source: 'ai_generated',
      context: {
        origin: 'JFK',
        destination: 'LHR'
      }
    });

    expect(optionId).toBeDefined();
    expect(typeof optionId).toBe('string');

    // Verify DB Persistence
    const { data: persistedOption } = await supabase
      .from('quotation_version_options')
      .select('*')
      .eq('id', optionId)
      .single();

    expect(persistedOption).toBeDefined();
    expect(persistedOption.source).toBe('ai_generated'); // Service overrides this based on logic or input
    // Check if QuoteOptionService mapped source_attribution correctly
    // In QuoteOptionService: source: rate.source_attribution || source
    // Here rate.source_attribution is 'AI Smart Engine'.
    // Wait, let's check the persisted value.
    expect(persistedOption.source_attribution).toBe('AI Smart Engine');
    expect(persistedOption.ai_generated).toBe(true);
    expect(persistedOption.ai_explanation).toBe('Based on historical data and current market rates.');
    expect(persistedOption.reliability_score).toBe(0.95);
    expect(persistedOption.total_amount).toBe(1500.00);
  });
});
