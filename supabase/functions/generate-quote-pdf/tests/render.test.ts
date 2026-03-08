
import { describe, it, expect, vi } from 'vitest';
import { PdfRenderer } from '../engine/renderer';
import { DefaultTemplate } from '../engine/default_template';
import { SafeContext } from '../engine/context';
import { I18nEngine } from '../engine/i18n';
import { Logger } from '../../_shared/logger';
import './setup'; // Ensure Deno mock is loaded

describe('PdfRenderer', () => {
  const mockLogger = new Logger(null);
  
  // Mock context with all required fields
  const mockContext: SafeContext = {
    quote: {
      number: "QUO-TEST-001",
      quote_number: "QUO-TEST-001",
      date: new Date().toISOString(),
      created_at: new Date().toISOString(),
      expiry: new Date(Date.now() + 86400000).toISOString(),
      expiration_date: new Date(Date.now() + 86400000).toISOString(),
      service_level: "Standard",
      currency: "USD",
      grand_total: 6500,
      origin: { location_name: "New York" },
      destination: { location_name: "London" }
    },
    customer: {
      name: "Test Company",
      company_name: "Test Company",
      contact: "John Doe",
      contact_name: "John Doe",
      address: "123 Test St",
      full_address: "123 Test St",
      phone: "555-0123",
      email: "test@example.com",
      code: "CUST001",
      inquiry_number: "INQ-999"
    },
    items: [
      { sequence_number: 1, type: "20' GP", qty: 1, commodity: "Electronics", details: "1000 kg / 10 cbm" }
    ],
    legs: [],
    charges: [],
    options: [
      {
        id: "opt-1",
        carrier: "Maersk",
        transit_time: "15 Days",
        frequency: "Weekly",
        container_size: "20'",
        container_type: "20' GP",
        grand_total: 2500,
        charges: [
           { desc: "Ocean Freight", total: 2000, curr: "USD" },
           { desc: "THC", total: 500, curr: "USD" }
        ],
        legs: [
           { seq: 1, mode: "Ocean", origin: "New York", destination: "London", carrier_name: "Maersk" }
        ]
      },
      {
        id: "opt-2",
        carrier: "MSC",
        transit_time: "18 Days",
        frequency: "Weekly",
        container_size: "40'",
        container_type: "40' HC",
        grand_total: 4000,
        charges: [
           { desc: "Ocean Freight", total: 3500, curr: "USD" },
           { desc: "THC", total: 500, curr: "USD" }
        ],
        legs: [
           { seq: 1, mode: "Ocean", origin: "New York", destination: "London", carrier_name: "MSC" }
        ]
      }
    ],
    meta: {
      locale: "en-US",
      generated_at: new Date().toISOString()
    },
    branding: {
      company_name: "My Logistics",
      company_address: "123 Logistics Way",
      primary_color: "#0087b5",
      secondary_color: "#dceef2",
      accent_color: "#000000",
      font_family: "Helvetica",
      header_text: "Professional Attitude",
      sub_header_text: "Contact Us",
      footer_text: "Page",
      disclaimer_text: "Terms apply"
    }
  };

  it('should render PDF successfully with DefaultTemplate', async () => {
    const renderer = new PdfRenderer(DefaultTemplate, mockContext, mockLogger);
    const pdfBytes = await renderer.render();
    expect(pdfBytes).toBeDefined();
    expect(pdfBytes.length).toBeGreaterThan(0);
  });

  it('should render key_value_grid with dynamic fields', async () => {
    const templateWithGrid = {
      ...DefaultTemplate,
      sections: [
        {
          type: "key_value_grid",
          height: 100,
          grid_fields: [
            { key: "customer.code", label: "Code" },
            { key: "customer.inquiry_number", label: "Inquiry" }
          ]
        }
      ]
    } as any;
    const renderer = new PdfRenderer(templateWithGrid, mockContext, mockLogger);
    const pdfBytes = await renderer.render();
    expect(pdfBytes).toBeDefined();
  });

  it('should render when template config is missing', async () => {
    const templateWithoutConfig = {
      name: "Template Missing Config",
      sections: [
        {
          type: "header",
          height: 80,
          content: { text: "Header", alignment: "left" }
        },
        {
          type: "key_value_grid",
          height: 80,
          grid_fields: [
            { key: "quote.quote_number", label: "Quote Ref" }
          ]
        }
      ]
    } as any;
    const renderer = new PdfRenderer(templateWithoutConfig, mockContext, mockLogger);
    const pdfBytes = await renderer.render();
    expect(pdfBytes).toBeDefined();
    expect(pdfBytes.length).toBeGreaterThan(0);
  });

  it('falls back to en-US when default_locale is missing', () => {
    const templateWithoutLocale = {
      name: "Template Missing Locale",
      i18n: {
        labels: {
          greeting: {
            "en-US": "Hello",
            "es-ES": "Hola"
          }
        }
      }
    } as any;
    const i18n = new I18nEngine(templateWithoutLocale, mockLogger);
    expect(i18n.t("greeting")).toBe("Hello");
  });

  it('renders MGL Standard Granular without config', async () => {
    const template = {
      name: "MGL Standard Granular",
      sections: [
        {
          type: "header",
          height: 80,
          content: { text: "MGL Standard Granular", alignment: "left" }
        },
        {
          type: "key_value_grid",
          height: 80,
          grid_fields: [
            { key: "quote.quote_number", label: "Quote Ref" }
          ]
        }
      ]
    } as any;
    const renderer = new PdfRenderer(template, mockContext, mockLogger);
    const pdfBytes = await renderer.render();
    expect(pdfBytes).toBeDefined();
    expect(pdfBytes.length).toBeGreaterThan(0);
  });

  it('renders MGL FCL Quote without config', async () => {
    const template = {
      name: "MGL FCL Quote",
      sections: [
        {
          type: "header",
          height: 80,
          content: { text: "MGL FCL Quote", alignment: "left" }
        },
        {
          type: "key_value_grid",
          height: 80,
          grid_fields: [
            { key: "quote.quote_number", label: "Quote Ref" }
          ]
        }
      ]
    } as any;
    const renderer = new PdfRenderer(template, mockContext, mockLogger);
    const pdfBytes = await renderer.render();
    expect(pdfBytes).toBeDefined();
    expect(pdfBytes.length).toBeGreaterThan(0);
  });

  it('renders MGL Granular Quote without config', async () => {
    const template = {
      name: "MGL Granular Quote",
      sections: [
        {
          type: "header",
          height: 80,
          content: { text: "MGL Granular Quote", alignment: "left" }
        },
        {
          type: "key_value_grid",
          height: 80,
          grid_fields: [
            { key: "quote.quote_number", label: "Quote Ref" }
          ]
        }
      ]
    } as any;
    const renderer = new PdfRenderer(template, mockContext, mockLogger);
    const pdfBytes = await renderer.render();
    expect(pdfBytes).toBeDefined();
    expect(pdfBytes.length).toBeGreaterThan(0);
  });

  it('builds container labels with size and type variants', () => {
    const renderer = new PdfRenderer(DefaultTemplate, mockContext, mockLogger) as any;
    expect(renderer.resolveItemContainerLabel({ container_size: "20FT", container_type: "GP" })).toBe("20FT GP");
    expect(renderer.resolveItemContainerLabel({ container_size: "40FT", type: "RF" })).toBe("40FT RF");
    expect(renderer.resolveItemContainerLabel({ container_size: "40FT HC", container_type: "OT" })).toBe("40FT HC OT");
    expect(renderer.resolveItemContainerLabel({ container_type: "20FT" })).toBe("20FT");
  });

  it('supports quantity and qty fields in cargo aggregation', () => {
    const renderer = new PdfRenderer(DefaultTemplate, mockContext, mockLogger) as any;
    expect(renderer.resolveItemQuantity({ quantity: 3 })).toBe(3);
    expect(renderer.resolveItemQuantity({ qty: 2 })).toBe(2);
    expect(renderer.resolveItemQuantity({})).toBe(0);
  });

  it('keeps positive negative and zero quantities in container rows', () => {
    const renderer = new PdfRenderer(DefaultTemplate, mockContext, mockLogger) as any;
    const rows = renderer.buildContainerBreakdownRows([
      { container_type: "Dry Standard", container_size: "20FT", quantity: 1, commodity: "Machinery" },
      { container_type: "Open Top", container_size: "40FT", quantity: -1, commodity: "Machinery" },
      { container_type: "Reefer", container_size: "20FT", quantity: 0, commodity: "Food" },
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ container_type: "Dry Standard", container_size: "20FT", quantity: 1 });
    expect(rows[1]).toMatchObject({ container_type: "Open Top", container_size: "40FT", quantity: -1 });
    expect(rows[2]).toMatchObject({ container_type: "Reefer", container_size: "20FT", quantity: 0 });
  });

  it('detects legacy cargo key-value grid fields', () => {
    const renderer = new PdfRenderer(DefaultTemplate, mockContext, mockLogger) as any;
    expect(renderer.isLegacyCargoGridField({ key: "items[0].type", label: "Equipment Type" })).toBe(true);
    expect(renderer.isLegacyCargoGridField({ key: "items[0].qty", label: "Quantity" })).toBe(true);
    expect(renderer.isLegacyCargoGridField({ key: "customer.email", label: "Email" })).toBe(false);
  });
});
