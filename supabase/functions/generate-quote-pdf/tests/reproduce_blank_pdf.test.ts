
import { describe, it, expect, vi } from "vitest";

// Mock Deno global
if (typeof (globalThis as any).Deno === "undefined") {
  (globalThis as any).Deno = {
    env: {
      get: (key: string) => process.env[key]
    }
  };
}

import { PdfRenderer } from "../engine/renderer";
import { SafeContext } from "../engine/context";
import { QuoteTemplate } from "../engine/schema";
import { Logger } from "../../_shared/logger";

describe("Reproduce Blank PDF Issue", () => {
  const logger = new Logger(null, {}, "test-id", "test-reproduce");

  // Mock Data mimicking QUO-260303-00002 state (missing version data)
  const mockContext: SafeContext = {
    quote: {
      number: "QUO-260303-00002",
      quote_number: "QUO-260303-00002",
      date: new Date().toISOString(),
      created_at: new Date().toISOString(),
      expiry: undefined,
      grand_total: 0,
      currency: "USD",
      service_level: "standard",
      origin: { location_name: "Origin" },
      destination: { location_name: "Destination" },
    },
    customer: {
      name: "Test Customer",
      company_name: "Test Customer",
      contact: "John Doe",
      contact_name: "John Doe",
      email: "john@example.com",
      phone: "123-456-7890",
      full_address: "123 Test St",
      address: "123 Test St",
      code: "CUST-001",
      inquiry_number: "INQ-001"
    },
    options: [], // EMPTY options
    items: [],   // EMPTY items
    legs: [],    // EMPTY legs
    charges: [], // EMPTY charges
    meta: {
      locale: "en-US",
      generated_at: new Date().toISOString(),
    },
    branding: {
      company_name: "Miami Global Lines",
      company_address: "140 Ethel Road West; Unit 'S&T', Piscataway, NJ 08854-USA",
      logo_url: "https://example.com/logo.png",
      primary_color: "#0087b5",
      secondary_color: "#dceef2",
      accent_color: "#333333",
      font_family: "Helvetica",
      header_text: "Header",
      sub_header_text: "Subheader",
      disclaimer_text: "Disclaimer",
      footer_text: "Footer"
    },
  };

  // Mock MGL Standard Granular Template (Flattened as per getTemplate logic)
  const mockTemplate: QuoteTemplate = {
    id: "2b2f7878-4f66-4c7d-9192-74d24bb5e97b",
    name: "MGL Standard Granular",
    tenant_id: "86962cdf-8179-4bb5-a89b-3bf57371314a",
    config: {
      margins: { top: 40, left: 40, right: 40, bottom: 40 },
      page_size: "A4",
      default_locale: "en-US"
    },
    header: {
      title: "QUOTATION",
      show_logo: true,
      company_info: true
    },
    footer: {
      text: "Thank you for your business."
    },
    layout: "granular", 
    sections: [
      {
        type: "customer_matrix_header",
        title: "Customer Information"
      },
      {
        type: "shipment_matrix_details",
        title: "Details (with Equipment/QTY)"
      },
      {
        type: "terms",
        title: "Terms & Conditions"
      },
      {
        type: "rates_matrix",
        title: "Freight Charges Matrix"
      }
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as any;

  it("should render PDF without crashing even with empty data", async () => {
    const renderer = new PdfRenderer(mockTemplate, mockContext, logger);
    await renderer.init();
    const pdfBytes = await renderer.render();
    
    expect(pdfBytes).toBeDefined();
    expect(pdfBytes.length).toBeGreaterThan(0);
    
    // Save to file for manual inspection if needed (optional)
    // await Deno.writeFile("reproduce_blank.pdf", pdfBytes);
  });

  it("should render PDF even if config is missing (simulating old state)", async () => {
    const brokenTemplate = JSON.parse(JSON.stringify(mockTemplate));
    delete brokenTemplate.config; // Simulate missing config

    const renderer = new PdfRenderer(brokenTemplate, mockContext, logger);
    await renderer.init();
    const pdfBytes = await renderer.render();
    
    expect(pdfBytes).toBeDefined();
    expect(pdfBytes.length).toBeGreaterThan(0);
  });
});
