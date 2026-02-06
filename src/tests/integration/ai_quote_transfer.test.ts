
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { QuoteOptionService } from '@/services/QuoteOptionService';
import { LogisticsPlugin } from '@/plugins/logistics/LogisticsPlugin';
import { logger } from '@/lib/logger';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Mock logger to avoid cluttering test output
logger.info = console.log;
logger.error = console.error;
logger.warn = console.warn;
logger.debug = () => {};

describe('AI Quote Transfer Integration', () => {
    let supabase: SupabaseClient;
    let tenantId: string;
    let quoteId: string;
    let versionId: string;

    beforeAll(async () => {
        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Missing Supabase URL or Key');
        }

        supabase = createClient(supabaseUrl, supabaseKey);

        // Get Tenant
        const { data: tenant, error } = await supabase
            .from('tenants')
            .select('id')
            .limit(1)
            .single();

        if (error || !tenant) throw new Error('Failed to fetch tenant');
        tenantId = tenant.id;
        console.log('Using Tenant ID:', tenantId);
    });

    afterAll(async () => {
        // Cleanup
        if (quoteId) {
            await supabase.from('quotes').delete().eq('id', quoteId);
        }
    });

    it('should create a quote and version with AI context', async () => {
        // Create Quote
        const { data: quote, error: quoteError } = await supabase
            .from('quotes')
            .insert({
                tenant_id: tenantId,
                status: 'draft',
                title: 'AI Transfer Test Quote'
            })
            .select()
            .single();

        expect(quoteError).toBeNull();
        expect(quote).toBeDefined();
        quoteId = quote.id;

        // Create Version
        const { data: version, error: versionError } = await supabase
            .from('quotation_versions')
            .insert({
                tenant_id: tenantId,
                quote_id: quote.id,
                version_number: 1
            })
            .select()
            .single();

        expect(versionError).toBeNull();
        expect(version).toBeDefined();
        versionId = version.id;

        // Update with AI Context
        const aiContextPayload = {
            marketAnalysis: "Market is volatile due to seasonal demand.",
            confidenceScore: 85.5,
            anomalies: ["High Fuel Surcharge Detected"]
        };

        const { error: updateError } = await supabase
            .from('quotation_versions')
            .update({
                market_analysis: aiContextPayload.marketAnalysis,
                confidence_score: aiContextPayload.confidenceScore,
                anomalies: aiContextPayload.anomalies
            })
            .eq('id', versionId);

        expect(updateError).toBeNull();

        // Verify Update
        const { data: verifiedVersion } = await supabase
            .from('quotation_versions')
            .select('*')
            .eq('id', versionId)
            .single();

        expect(verifiedVersion.market_analysis).toBe(aiContextPayload.marketAnalysis);
        expect(verifiedVersion.confidence_score).toBe(aiContextPayload.confidenceScore);
        expect(JSON.stringify(verifiedVersion.anomalies)).toBe(JSON.stringify(aiContextPayload.anomalies));
    });

    it('should insert an AI-generated option with correct fields', async () => {
        // Fetch Master Data for Mock Mapper
        const [
            { data: categories },
            { data: sides },
            { data: bases },
            { data: currencies },
            { data: serviceTypes },
            { data: serviceModes },
            { data: carriers }
        ] = await Promise.all([
            supabase.from('charge_categories').select('id, code, name'),
            supabase.from('charge_sides').select('id, code, name'),
            supabase.from('charge_bases').select('id, code, name'),
            supabase.from('currencies').select('id, code'),
            supabase.from('service_types').select('id, code, name, transport_modes(code)'),
            supabase.from('service_modes').select('id, code, name'),
            supabase.from('carriers').select('id, carrier_name, scac')
        ]);

        const mockMapper = {
            getCatId: (code: string) => categories?.find((c: any) => c.code === code || c.name === code)?.id || categories?.[0]?.id,
            getSideId: (code: string) => sides?.find((s: any) => s.code === code || s.name === code)?.id || sides?.[0]?.id,
            getBasisId: (code: string) => bases?.find((b: any) => b.code === code || b.name === code)?.id || bases?.[0]?.id,
            getCurrId: (code: string) => currencies?.find((c: any) => c.code === code)?.id || currencies?.[0]?.id,
            getServiceTypeId: (mode: string, tier: string) => serviceTypes?.[0]?.id,
            getModeId: (code: string) => serviceModes?.find((m: any) => m.code === code || m.name === code)?.id || serviceModes?.[0]?.id,
            getProviderId: (name: string) => carriers?.find((c: any) => c.carrier_name === name)?.id || carriers?.[0]?.id,
            getSideIdByCode: (code: string) => sides?.find((s: any) => s.code === code)?.id
        };

        const quoteOptionService = new QuoteOptionService(supabase);

        const mockAiRate = {
            id: "ai-generated-option-1",
            carrier_name: "Maersk",
            total_amount: 1500,
            currency: "USD",
            service_type: "Port to Port",
            transit_time: "25 Days",
            // AI Fields
            reliability_score: 92,
            ai_generated: true,
            ai_explanation: "Selected for high reliability and optimal route.",
            source_attribution: "AI Smart Engine",
            // Legs
            legs: [
                { mode: "ocean", from: "CNSHA", to: "USLAX", transit_time: 25 }
            ],
            // Charges
            charges: [
                { description: "Ocean Freight", amount: 1200, currency: "USD" },
                { description: "THC", amount: 300, currency: "USD" }
            ]
        };

        const optionId = await quoteOptionService.addOptionToVersion({
            tenantId: tenantId,
            versionId: versionId,
            rate: mockAiRate,
            rateMapper: mockMapper,
            source: 'ai_generated',
            context: {
                origin: 'Shanghai',
                destination: 'Los Angeles'
            }
        });

        expect(optionId).toBeDefined();

        // Verify Persistence
        const { data: verifiedOption, error } = await supabase
            .from('quotation_version_options')
            .select('*')
            .eq('id', optionId)
            .single();

        expect(error).toBeNull();
        expect(verifiedOption.reliability_score).toBe(92);
        expect(verifiedOption.ai_generated).toBe(true);
        expect(verifiedOption.ai_explanation).toBe("Selected for high reliability and optimal route.");
        // The source might be 'ai_generated' or 'AI Smart Engine' depending on logic priority
        expect(['AI Smart Engine', 'ai_generated']).toContain(verifiedOption.source);
    });
});
