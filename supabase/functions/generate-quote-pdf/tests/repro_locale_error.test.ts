
import { describe, it, expect } from 'vitest';
import { PdfRenderer } from "../engine/renderer.ts";
import { QuoteTemplate } from "../engine/schema.ts";
import { SafeContext } from "../engine/context.ts";

// Mock logger
const mockLogger: any = {
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {}
};

// Mock Deno.env if needed (though we're testing logic mostly)
if (!(globalThis as any).Deno) {
  // @ts-ignore: Mocking Deno global
  (globalThis as any).Deno = {
    env: {
      get: () => undefined,
      toObject: () => ({})
    }
  };
}

describe("PdfRenderer - Resilience against missing data", () => {
  
  it("should handle missing template.config without crashing", async () => {
    // Cast to any to bypass type checking for missing required config
    const template: any = {
      id: 'test-1',
      name: 'Test Template',
      version: "1",
      layout_engine: 'v1',
      // config is MISSING
      sections: []
    };

    const context: SafeContext = {
      quote: { id: 'q1', currency: 'USD' },
      branding: {},
      options: []
    } as any;

    const renderer = new PdfRenderer(template, context, mockLogger);
    
    try {
      await renderer.render();
    } catch (e: any) {
        console.log('Caught expected error:', e.message);
        // We expect it NOT to crash with "Cannot read properties of undefined (reading 'default_locale')"
        // If it does, we need to fix it.
        if (e.message.includes("Cannot read properties of undefined") && e.message.includes("default_locale")) {
             throw new Error("Reproduced: Cannot read properties of undefined (reading 'default_locale')");
        }
    }
  });

  it("should handle missing context.meta in renderKeyValueGrid", async () => {
    const template: QuoteTemplate = {
      id: 'test-2',
      name: 'Test Template',
      version: "1",
      layout_engine: 'v1',
      config: { 
          default_locale: 'fr-FR',
          page_size: 'A4',
          margins: { top: 10, bottom: 10, left: 10, right: 10 },
          font_family: 'Helvetica',
          compliance: 'None'
      },
      sections: [
        {
          type: 'key_value_grid',
          page_break_before: false,
          grid_fields: [
            { key: 'quote.created_at', label: 'Date', format: 'date' },
            { key: 'quote.amount', label: 'Amount', format: 'currency' }
          ]
        }
      ]
    };

    // context.meta is MISSING
    const context: SafeContext = {
      quote: { id: 'q1', currency: 'USD', created_at: '2023-01-01', amount: 100 },
      branding: {},
      options: []
    } as any;

    const renderer = new PdfRenderer(template, context, mockLogger);
    
    try {
      await renderer.render();
    } catch (e: any) {
        console.log('Caught expected error:', e.message);
        // If it throws "reading 'locale'", we found a bug!
        if (e.message.includes("Cannot read properties of undefined") && e.message.includes("locale")) {
            throw new Error("Reproduced: Cannot read properties of undefined (reading 'locale')");
        }
    }
  });
  
  it("should handle resolvePath with array access on undefined", async () => {
      const template: QuoteTemplate = {
        id: 'test-3',
        name: 'Test Template',
        version: "1",
        layout_engine: 'v1',
        config: { 
            default_locale: 'en-US',
            page_size: 'A4',
            margins: { top: 10, bottom: 10, left: 10, right: 10 },
            font_family: 'Helvetica',
            compliance: 'None'
        },
        sections: [
          {
            type: 'key_value_grid',
            page_break_before: false,
            grid_fields: [
              { key: 'quote.items[0].name', label: 'Item Name' } // Accessing array index
            ]
          }
        ]
      };
  
      const context: SafeContext = {
        quote: { id: 'q1', currency: 'USD', items: [] }, // items is empty
        branding: {},
        options: [],
        meta: { locale: 'en-US' }
      } as any;
  
      const renderer = new PdfRenderer(template, context, mockLogger);
      
      try {
        await renderer.render();
      } catch (e: any) {
          console.log('Caught error in resolvePath test:', e.message);
      }
  });
});
