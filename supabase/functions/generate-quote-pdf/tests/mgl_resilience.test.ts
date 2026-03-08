
import { describe, it, expect } from 'vitest';
import { PdfRenderer } from '../engine/renderer';
import { SafeContext } from '../engine/context';
import { Logger } from '../../_shared/logger';
import './setup';

describe('PdfRenderer Resilience', () => {
  const mockLogger = new Logger(null);
  
  const mockContext: SafeContext = {
    quote: {
      number: "QUO-MGL-001",
      quote_number: "QUO-MGL-001",
      date: new Date().toISOString(),
      created_at: new Date().toISOString(),
      expiry: new Date().toISOString(),
      expiration_date: new Date().toISOString(),
      service_level: "Standard",
      currency: "USD",
      grand_total: 5000,
      origin: { location_name: "Miami" },
      destination: { location_name: "London" }
    },
    customer: {
      name: "MGL Client",
      company_name: "MGL Client Corp",
      contact: "Jane Doe",
      contact_name: "Jane Doe",
      address: "123 Ocean Dr",
      full_address: "123 Ocean Dr",
      phone: "555-0000",
      email: "jane@example.com",
      code: "CUST-MGL",
      inquiry_number: "INQ-MGL"
    },
    items: [],
    legs: [],
    charges: [],
    options: [],
    meta: {
      locale: "en-US",
      generated_at: new Date().toISOString()
    },
    branding: {
      company_name: "Miami Global Lines",
      company_address: "100 Port Blvd",
      primary_color: "#0000FF",
      secondary_color: "#CCCCCC",
      accent_color: "#FF0000",
      font_family: "Helvetica",
      header_text: "Quote",
      sub_header_text: "Details",
      footer_text: "Page",
      disclaimer_text: "Standard Terms"
    }
  };

  it('should render PDF even when template config is completely missing (MGL Scenario)', async () => {
    // Simulate MGL template with NO config object
    const brokenTemplate = {
      id: "mgl-broken-1",
      name: "MGL Standard Granular (Broken)",
      sections: [
        {
          type: "header",
          content: "<h1>Quote {{quote.number}}</h1>",
          styles: {}
        }
      ]
      // Notice: NO config property
    } as any;

    const renderer = new PdfRenderer(brokenTemplate, mockContext, mockLogger);
    
    // This would throw "Cannot read properties of undefined (reading 'default_locale')" before the fix
    // or "Cannot read properties of undefined (reading 'margins')"
    await expect(renderer.render()).resolves.toBeDefined();
    
    const pdfBytes = await renderer.render();
    expect(pdfBytes.length).toBeGreaterThan(0);
  });

  it('should render PDF when config exists but margins/locale are missing', async () => {
    const partialTemplate = {
      id: "mgl-partial-1",
      name: "MGL FCL Quote (Partial)",
      config: {
        // Empty config
      },
      sections: [
        { type: "static_block", content: "Test Content" }
      ]
    } as any;

    const renderer = new PdfRenderer(partialTemplate, mockContext, mockLogger);
    await expect(renderer.render()).resolves.toBeDefined();
  });

  it('should handle malformed margins gracefully', async () => {
    const malformedTemplate = {
      id: "mgl-malformed-1",
      name: "MGL Granular Quote (Malformed)",
      config: {
        margins: "invalid-string" // Should be object
      },
      sections: []
    } as any;

    const renderer = new PdfRenderer(malformedTemplate, mockContext, mockLogger);
    // Should fallback to default margins (40)
    await expect(renderer.render()).resolves.toBeDefined();
  });
});
