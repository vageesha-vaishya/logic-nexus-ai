
import { describe, it, expect, beforeAll } from 'vitest';
import { QuoteFactory } from '../helpers/QuoteFactory';
import { SupabaseHelper } from '../helpers/SupabaseHelper';
import { PDFValidator } from '../helpers/PDFValidator';

describe('Quotation System E2E', () => {
    let factory: QuoteFactory;
    const supabase = SupabaseHelper.getClient();
    let tenantId: string;
    let accountId: string;
    let originPortId: string;
    let destPortId: string;

    beforeAll(async () => {
        factory = new QuoteFactory();
        await factory.init();
        
        // Get Tenant
        const { data: t } = await supabase.from('tenants').select('id').limit(1).single();
        if (!t) throw new Error('No tenant found');
        tenantId = t.id;

        // Get Account
        const { data: acc } = await supabase.from('accounts').select('id').eq('tenant_id', tenantId).limit(1).maybeSingle();
        if (!acc) throw new Error('No account found');
        accountId = acc.id;

        // Get Ports
        const { data: ports } = await supabase.from('ports_locations').select('id').limit(2);
        if (!ports || ports.length < 2) throw new Error('Not enough ports found');
        originPortId = ports[0].id;
        destPortId = ports[1].id;
    }, 30000); // Increased timeout for setup

    it('Scenario 1: Default Rates (Quick Quote Flow)', async () => {
        // 1. Create Quote
        const quote = await factory.createQuote({
            tenantId,
            accountId,
            originPortId,
            destPortId
        });
        expect(quote).toBeDefined();

        // 2. Add Items
        await factory.addQuoteItem(quote.id, '20GP');

        // 3. Create Version
        const version = await factory.createVersion(quote.id);

        // 4. Add Option (Simulating Quick Quote Result)
        await factory.addOption(version.id, {
            carrierName: 'Generic Carrier',
            transitDays: 25,
            containerSizeCode: '20GP',
            charges: [
                { name: 'Ocean Freight', amount: 1500 },
                { name: 'THC', amount: 200 }
            ],
            legs: [
                { mode: 'ocean', originId: originPortId, destId: destPortId }
            ]
        });

        // 5. Generate PDF
        const { data: pdfData, error: pdfError } = await supabase.functions.invoke('generate-quote-pdf', {
            body: { quoteId: quote.id, templateId: 'cf58b647-10ab-495e-8907-cb4756e01b45' }, // Using MGL ID or default
            headers: { 'X-E2E-Key': 'trae-bypass-verification-2026' }
        });
        
        expect(pdfError).toBeNull();
        expect(pdfData).toBeDefined();
        expect(pdfData.content).toBeDefined();
        console.log('PDF Content Length:', pdfData.content?.length);
        console.log('PDF Content Start:', pdfData.content?.substring(0, 50));

        // 6. Validate PDF
        const validation = await PDFValidator.validate(pdfData.content);
        expect(validation.isValid).toBe(true);
        expect(validation.pageCount).toBeGreaterThan(0);
        
        // Content Checks
        expect(validation.text).toContain('Generic Carrier');
        expect(validation.text).toContain('Ocean Freight');
        expect(validation.text).toContain('1500');
        expect(validation.text).toContain('USD'); // Currency check

        // 7. Send Email
        const emailPayload = {
            to: ['bahuguna.vimal@gmail.com'],
            subject: `E2E Test: Quick Quote ${quote.quote_number}`,
            body: '<h1>Quick Quote Test</h1><p>Default rates scenario.</p>',
            provider: 'resend',
            attachments: [{
                filename: `Quote_${quote.quote_number}.pdf`,
                content: pdfData.content,
                contentType: 'application/pdf'
            }]
        };

        const { data: emailData, error: emailError } = await supabase.functions.invoke('send-email', {
            body: emailPayload,
            headers: { 'X-E2E-Key': 'trae-bypass-verification-2026' }
        });

        expect(emailError).toBeNull();
        expect(emailData.success).toBe(true);
    }, 60000);

    it('Scenario 2: Custom Data (Maersk Multi-Leg Flow)', async () => {
        // 1. Create Quote
        const quote = await factory.createQuote({
            tenantId,
            accountId,
            originPortId,
            destPortId
        });

        // 2. Add Items
        await factory.addQuoteItem(quote.id, '20GP', 1, 1);
        await factory.addQuoteItem(quote.id, '40GP', 1, 2);

        // 3. Create Version
        const version = await factory.createVersion(quote.id);

        // 4. Add Option: Maersk (Multi-Leg, Granular)
        // Leg 1: Road (Origin -> Origin)
        // Leg 2: Ocean (Origin -> Dest)
        await factory.addOption(version.id, {
            carrierName: 'Maersk Line',
            transitDays: 32,
            containerSizeCode: '20GP',
            charges: [
                { name: 'Trucking', amount: 400, legIndex: 0 },
                { name: 'Ocean Freight', amount: 2500, legIndex: 1 },
                { name: 'BAF', amount: 350, legIndex: 1 },
                { name: 'Internal Cost', amount: 999.99, legIndex: 1, side: 'Buy' } // Should NOT appear in PDF
            ],
            legs: [
                { mode: 'road', originId: originPortId, destId: originPortId },
                { mode: 'ocean', originId: originPortId, destId: destPortId }
            ]
        });

        // Add Option for 40GP as well
        await factory.addOption(version.id, {
            carrierName: 'Maersk Line',
            transitDays: 32,
            containerSizeCode: '40GP',
            charges: [
                { name: 'Trucking', amount: 600, legIndex: 0 },
                { name: 'Ocean Freight', amount: 4500, legIndex: 1 },
                { name: 'BAF', amount: 600, legIndex: 1 }
            ],
            legs: [
                { mode: 'road', originId: originPortId, destId: originPortId },
                { mode: 'ocean', originId: originPortId, destId: destPortId }
            ]
        });

        // 5. Generate PDF
        const { data: pdfData, error: pdfError } = await supabase.functions.invoke('generate-quote-pdf', {
            body: { quoteId: quote.id, templateId: 'cf58b647-10ab-495e-8907-cb4756e01b45' },
            headers: { 'X-E2E-Key': 'trae-bypass-verification-2026' }
        });

        if (pdfError) console.error('PDF Error:', pdfError);
        expect(pdfError).toBeNull();
        expect(pdfData.content).toBeDefined();

        // 6. Validate PDF
        const validation = await PDFValidator.validate(pdfData.content);
        expect(validation.isValid).toBe(true);
        
        // Granular Checks
        expect(validation.text).toContain('Maersk Line');
        expect(validation.text).toContain('Trucking');
        expect(validation.text).toContain('400'); // 20GP Trucking
        expect(validation.text).toContain('Ocean Freight');
        expect(validation.text).toContain('2500'); // 20GP Ocean
        expect(validation.text).toContain('USD');
        
        // Negative Checks (Internal Data)
        expect(validation.text).not.toContain('Internal Cost');
        expect(validation.text).not.toContain('999.99');

        // 7. Send Email
        const emailPayload = {
            to: ['bahuguna.vimal@gmail.com'],
            subject: `E2E Test: Maersk Granular ${quote.quote_number}`,
            body: '<h1>Maersk Scenario</h1><p>Multi-Leg, Granular Charges.</p>',
            provider: 'resend',
            attachments: [{
                filename: `Quote_${quote.quote_number}.pdf`,
                content: pdfData.content,
                contentType: 'application/pdf'
            }]
        };

        const { data: emailData, error: emailError } = await supabase.functions.invoke('send-email', {
            body: emailPayload,
            headers: { 'X-E2E-Key': 'trae-bypass-verification-2026' }
        });

        expect(emailError).toBeNull();
        expect(emailData.success).toBe(true);
    }, 60000);
});
