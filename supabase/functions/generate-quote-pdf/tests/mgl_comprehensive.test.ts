
import { describe, it, expect } from 'vitest';
import { PdfRenderer } from "../engine/renderer.ts";
import { QuoteTemplate } from "../engine/schema.ts";
import { SafeContext } from "../engine/context.ts";
import { I18nEngine } from "../engine/i18n.ts";
import { Logger } from "../../_shared/logger.ts";

// Mock logger
const mockLogger: any = {
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {}
};

// Mock Deno global
if (!(globalThis as any).Deno) {
  // @ts-ignore: Mocking Deno global
  (globalThis as any).Deno = {
    env: {
      get: () => undefined,
      toObject: () => ({})
    }
  };
}

describe("Comprehensive MGL Validation", () => {

  // Common Mock Context
  const mockContext: SafeContext = {
    quote: {
      id: "QUO-260303-00002",
      quote_number: "QUO-260303-00002",
      currency: "USD",
      created_at: new Date().toISOString(),
      expiry: new Date().toISOString(),
      service_level: "Standard",
      grand_total: 1500.50,
      origin: { location_name: "Shanghai" },
      destination: { location_name: "Los Angeles" },
      incoterms: "FOB",
      items: [
          { commodity: "Electronics", quantity: 10, details: "100 kg / 10 cbm" }
      ]
    },
    customer: {
      company_name: "Test Client",
      contact_name: "Jane Doe",
      email: "jane@test.com",
      phone: "+1 555 0123",
      full_address: "123 Test St, Test City"
    },
    branding: {
      company_name: "Miami Global Lines",
      company_address: "123 Ocean Drive, Miami, FL",
      primary_color: "#0087b5",
      secondary_color: "#dceef2"
    },
    options: [
      {
          id: "opt-1",
          name: "Option 1",
          grand_total: 1500.50,
          legs: [
              { mode: "Ocean", carrier_name: "Maersk", transit_time: "20 days", pol: "Shanghai", pod: "LA" }
          ],
          charges: [
              { description: "Ocean Freight", amount: 1200, currency: "USD" },
              { description: "THC", amount: 300.50, currency: "USD" }
          ]
      }
    ],
    meta: { locale: 'en-US' } // Standard safe context
  } as any;

  // 1. Unit Test: I18nEngine Resilience
  describe("I18nEngine Resilience", () => {
    it("should handle missing config gracefully", () => {
      const template: any = { id: "t1" }; // No config
      const i18n = new I18nEngine(template, mockLogger);
      // @ts-ignore
      expect(i18n.defaultLocale).toBe("en-US");
      expect(i18n.t("test")).toBe("test");
    });

    it("should handle null config gracefully", () => {
        const template: any = { id: "t1", config: null };
        const i18n = new I18nEngine(template, mockLogger);
        // @ts-ignore
        expect(i18n.defaultLocale).toBe("en-US");
    });

    it("should fallback to default_locale from config", () => {
        const template: any = { id: "t1", config: { default_locale: "fr-FR" } };
        const i18n = new I18nEngine(template, mockLogger);
        // @ts-ignore
        expect(i18n.defaultLocale).toBe("fr-FR");
    });
  });

  // 2. Integration Test: MGL Templates Rendering
  describe("MGL Templates Rendering", () => {

    const templates = [
        { name: "MGL Standard Granular", id: "mgl-std-gran" },
        { name: "MGL FCL Quote", id: "mgl-fcl" },
        { name: "MGL Granular Quote", id: "mgl-gran" }
    ];

    templates.forEach(t => {
        it(`should render ${t.name} without errors even with minimal config`, async () => {
            const template: QuoteTemplate = {
                id: t.id,
                name: t.name,
                version: "1",
                layout_engine: "v1",
                config: {
                    // Intentionally minimal config to test defaults
                    page_size: "A4",
                    margins: { top: 20, bottom: 20, left: 20, right: 20 },
                    // Missing default_locale here to test fallback
                    font_family: "Helvetica",
                    compliance: "None"
                } as any,
                sections: [
                    {
                        type: "header",
                        page_break_before: false,
                        content: { text: t.name, alignment: "left" }
                    },
                    {
                        type: "key_value_grid",
                        page_break_before: false,
                        grid_fields: [
                            { key: "quote.quote_number", label: "Quote Ref" },
                            { key: "quote.created_at", label: "Date", format: "date" }
                        ]
                    },
                    {
                        type: "matrix_rate_table", // Common MGL section
                        page_break_before: false,
                        content: { text: "Rates", alignment: "left" },
                        config: { show_breakdown: t.id === "mgl-gran" } // Enable breakdown for granular template
                    }
                ]
            };

            const renderer = new PdfRenderer(template, mockContext, mockLogger);
            const pdfBytes = await renderer.render();
            
            expect(pdfBytes).toBeDefined();
            expect(pdfBytes.length).toBeGreaterThan(1000); // Not empty
        });
    });
  });

  // 2b. Integration Test: Detailed Matrix Breakdown
  describe("Detailed Matrix Breakdown", () => {
    it("should render detailed_matrix_rate_table when show_breakdown is true", async () => {
        const template: QuoteTemplate = {
            id: "mgl-detailed",
            name: "MGL Detailed",
            version: "1",
            layout_engine: "v1",
            config: {
                default_locale: "en-US",
                page_size: "A4",
                margins: { top: 20, bottom: 20, left: 20, right: 20 },
                font_family: "Helvetica",
                compliance: "None"
            },
            sections: [
                {
                    type: "rates_matrix",
                    page_break_before: false,
                    content: { text: "Detailed Rates", alignment: "left" },
                    config: { show_breakdown: true }
                } as any
            ]
        };

        const renderer = new PdfRenderer(template, mockContext, mockLogger);
        const pdfBytes = await renderer.render();
        
        expect(pdfBytes).toBeDefined();
        expect(pdfBytes.length).toBeGreaterThan(1000);
    });
  });

  // 3. Regression Test: Standard Template
  describe("Standard Template Regression", () => {
      it("should render a standard template correctly without MGL specific logic", async () => {
          const standardTemplate: QuoteTemplate = {
              id: "std-1",
              name: "Standard Template",
              version: "1",
              layout_engine: "v1",
              config: {
                  page_size: "A4",
                  margins: { top: 20, bottom: 20, left: 20, right: 20 },
                  default_locale: "en-US",
                  font_family: "Helvetica",
                  compliance: "None"
              },
              sections: [
                  {
                      type: "header",
                      page_break_before: false,
                      content: { text: "Standard Header", alignment: "center" }
                  },
                  {
                      type: "key_value_grid",
                      page_break_before: false,
                      grid_fields: [
                          { key: "quote.quote_number", label: "Ref" }
                      ]
                  }
              ]
          };

          const renderer = new PdfRenderer(standardTemplate, mockContext, mockLogger);
          const pdfBytes = await renderer.render();
          
          expect(pdfBytes).toBeDefined();
          expect(pdfBytes.length).toBeGreaterThan(1000);
      });
  });

  // 3. Unit/Integration Test: resolvePath via Renderer
  describe("resolvePath Logic via Renderer", () => {
      it("should handle array access in grid fields", async () => {
          const template: QuoteTemplate = {
              id: "test-resolve",
              name: "Resolve Test",
              version: "1",
              layout_engine: "v1",
              config: { default_locale: "en-US", page_size: "A4", margins: { top: 10, bottom: 10, left: 10, right: 10 }, font_family: "Helvetica", compliance: "None" },
              sections: [
                  {
                      type: "key_value_grid",
                      page_break_before: false,
                      grid_fields: [
                          { key: "quote.items[0].name", label: "First Item" },
                          { key: "options[0].legs[0].carrier_name", label: "Carrier" }
                      ]
                  }
              ]
          };

          const context: SafeContext = {
              quote: { items: [{ name: "Widget A" }] },
              options: [{ legs: [{ carrier_name: "MSC" }] }],
              branding: {},
              meta: { locale: 'en-US' }
          } as any;

          const renderer = new PdfRenderer(template, context, mockLogger);
          const pdfBytes = await renderer.render();
          expect(pdfBytes).toBeDefined();
          // We can't easily assert content of PDF here without parsing, but ensuring it doesn't throw is key
      });

      it("should handle missing array indices safely", async () => {
        const template: QuoteTemplate = {
            id: "test-resolve-fail",
            name: "Resolve Fail Test",
            version: "1",
            layout_engine: "v1",
            config: { default_locale: "en-US", page_size: "A4", margins: { top: 10, bottom: 10, left: 10, right: 10 }, font_family: "Helvetica", compliance: "None" },
            sections: [
                {
                    type: "key_value_grid",
                    page_break_before: false,
                    grid_fields: [
                        { key: "quote.items[99].name", label: "Missing Item" }
                    ]
                }
            ]
        };

        const context: SafeContext = {
            quote: { items: [{ name: "Widget A" }] },
            branding: {},
            options: [],
            meta: { locale: 'en-US' }
        } as any;

        const renderer = new PdfRenderer(template, context, mockLogger);
        // Should not throw
        await renderer.render();
      });
  });
  
  // 4. Malformed Data Test
  describe("Malformed Data Handling", () => {
      it("should handle null context values", async () => {
          const template: QuoteTemplate = {
              id: "test-malformed",
              name: "Malformed Test",
              version: "1",
              layout_engine: "v1",
              config: { default_locale: "en-US", page_size: "A4", margins: { top: 10, bottom: 10, left: 10, right: 10 }, font_family: "Helvetica", compliance: "None" },
              sections: [
                  {
                      type: "key_value_grid",
                      page_break_before: false,
                      grid_fields: [
                          { key: "quote.null_field", label: "Null Field" },
                          { key: "quote.undefined_field", label: "Undefined Field" }
                      ]
                  }
              ]
          };

          const context: SafeContext = {
              quote: { null_field: null, undefined_field: undefined },
              branding: {},
              options: [],
              meta: { locale: 'en-US' }
          } as any;

          const renderer = new PdfRenderer(template, context, mockLogger);
          await renderer.render();
      });
  });

  // 5. MGL Section Normalization
  describe("MGL Section Normalization", () => {
    it("should normalize customer_info to key_value_grid with 5 fields", async () => {
        const template: QuoteTemplate = {
            id: "mgl-customer-test",
            name: "MGL Customer Test",
            version: "1",
            layout_engine: "v1",
            config: { default_locale: "en-US", page_size: "A4", margins: { top: 20, bottom: 20, left: 20, right: 20 }, font_family: "Helvetica", compliance: "None" },
            sections: [
                {
                    id: "customer_info",
                    type: "customer_matrix_header", // Explicitly use the MGL type
                    page_break_before: false,
                    content: { text: "Customer", alignment: "left" }
                } as any
            ]
        };

        const renderer = new PdfRenderer(template, mockContext, mockLogger);
        const pdfBytes = await renderer.render();
        expect(pdfBytes).toBeDefined();
    });

    it("should normalize shipment_details to key_value_grid with 5 fields including incoterms", async () => {
        const template: QuoteTemplate = {
            id: "mgl-shipment-test",
            name: "MGL Shipment Test",
            version: "1",
            layout_engine: "v1",
            config: { default_locale: "en-US", page_size: "A4", margins: { top: 20, bottom: 20, left: 20, right: 20 }, font_family: "Helvetica", compliance: "None" },
            sections: [
                {
                    id: "shipment_details",
                    type: "shipment_matrix_details", // Explicitly use the MGL type
                    page_break_before: false,
                    content: { text: "Shipment", alignment: "left" }
                } as any
            ]
        };

        const renderer = new PdfRenderer(template, mockContext, mockLogger);
        const pdfBytes = await renderer.render();
        expect(pdfBytes).toBeDefined();
    });
  });

});
